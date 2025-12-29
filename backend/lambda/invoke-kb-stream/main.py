"""
Lambda function with FastAPI to invoke Bedrock Knowledge Base with RetrieveAndGenerateStream API.
Uses Lambda Web Adapter Layer for HTTP response streaming to API Gateway.

API Reference:
- RetrieveAndGenerateStream: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_RetrieveAndGenerateStream.html
"""

import os
import json
import re
import uuid
import time
from datetime import datetime, timezone
import boto3
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware to handle cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AWS clients
bedrock_agent_runtime = boto3.client("bedrock-agent-runtime")
dynamodb = boto3.resource("dynamodb")

# Environment variables
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID")
AWS_REGION = os.environ.get("AWS_REGION")
CONVERSATION_HISTORY_TABLE = os.environ.get("CONVERSATION_HISTORY_TABLE")

# Model ID for generation - using global inference profile
MODEL_ID = "global.amazon.nova-2-lite-v1:0"


def save_conversation_to_dynamodb(
    conversation_id: str,
    session_id: str,
    question: str,
    answer: str,
    citations: list,
    response_time_ms: int,
    language: str = "en"
) -> bool:
    """
    Save a conversation Q&A pair to DynamoDB for analytics.
    
    Returns True if successful, False otherwise.
    """
    if not CONVERSATION_HISTORY_TABLE:
        print("CONVERSATION_HISTORY_TABLE not configured, skipping save")
        return False
    
    try:
        table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
        
        now = datetime.now(timezone.utc)
        timestamp = now.isoformat()
        date = now.strftime("%Y-%m-%d")
        
        item = {
            "conversationId": conversation_id,
            "timestamp": timestamp,
            "sessionId": session_id or "anonymous",
            "date": date,
            "question": question,
            "answer": answer,
            "citations": json.dumps(citations) if citations else "[]",
            "citationCount": len(citations) if citations else 0,
            # feedback: null (not set) = no feedback, "pos" = positive, "neg" = negative
            # DynamoDB doesn't store null attributes, saving space
            "responseTimeMs": response_time_ms,
            "modelId": MODEL_ID,
            "knowledgeBaseId": KNOWLEDGE_BASE_ID,
            "language": language,
            "questionLength": len(question),
            "answerLength": len(answer),
        }
        
        table.put_item(Item=item)
        print(f"Saved conversation {conversation_id} to DynamoDB")
        return True
        
    except Exception as e:
        print(f"Error saving conversation to DynamoDB: {e}")
        return False


def s3_uri_to_public_url(s3_uri: str) -> str | None:
    """
    Convert S3 URI to public HTTPS URL.
    Only converts URIs from the public/ prefix for security.
    
    Input:  s3://bucket-name/public/folder/image.jpg
    Output: https://bucket-name.s3.us-east-1.amazonaws.com/public/folder/image.jpg
    
    Returns None if the URI is not from the public/ folder.
    """
    if not s3_uri or "/public/" not in s3_uri:
        return None
    
    # Parse S3 URI: s3://bucket-name/key
    match = re.match(r"^s3://([^/]+)/(.+)$", s3_uri)
    if not match:
        return None
    
    bucket_name, key = match.groups()
    
    # Double-check the key starts with public/
    if not key.startswith("public/"):
        return None
    
    # Return public HTTPS URL
    return f"https://{bucket_name}.s3.{AWS_REGION}.amazonaws.com/{key}"

async def stream_kb_response(query: str, session_id: str = None, number_of_results: int = 5, language: str = "en"):
    """
    Stream response from Bedrock Knowledge Base using RetrieveAndGenerateStream API.
    
    Streams text chunks first, then sends all citations/metadata at the end.
    Also saves the conversation to DynamoDB for analytics.
    
    Event order:
    1. conversationId (unique ID for this Q&A)
    2. sessionId (if available)
    3. text chunks (streamed as they arrive)
    4. metadata (citations, guardrail) at the end
    5. done
    """
    
    # Generate unique conversation ID for this Q&A pair
    conversation_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Build request per AWS API specification
    request_params = {
        "input": {
            "text": query
        },
        "retrieveAndGenerateConfiguration": {
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": KNOWLEDGE_BASE_ID,
                "modelArn": MODEL_ID,
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "numberOfResults": number_of_results
                    }
                }
            }
        }
    }
    
    if session_id:
        request_params["sessionId"] = session_id
    
    try:
        # Send conversation ID as first event (for feedback tracking)
        yield f"event: conversationId\ndata: {json.dumps({'conversationId': conversation_id})}\n\n"
        
        # Call RetrieveAndGenerateStream API
        response = bedrock_agent_runtime.retrieve_and_generate_stream(**request_params)
        
        # Get session ID from response
        response_session_id = response.get("sessionId")
        
        # Send session ID
        if response_session_id:
            yield f"event: sessionId\ndata: {json.dumps({'sessionId': response_session_id})}\n\n"
        
        # Collect full response for saving to DynamoDB
        full_response_text = ""
        all_citations = []
        guardrail_action = None
        
        # Process streaming response - stream text immediately, collect metadata
        stream = response.get("stream")
        if stream:
            for stream_event in stream:
                # Handle output event - stream text immediately
                if "output" in stream_event:
                    output = stream_event["output"]
                    if "text" in output:
                        text_chunk = output['text']
                        full_response_text += text_chunk
                        yield f"event: text\ndata: {json.dumps({'text': text_chunk})}\n\n"
                
                # Collect citation events for later
                if "citation" in stream_event:
                    citation = stream_event["citation"]
                    formatted_citation = format_citation(citation)
                    all_citations.append(formatted_citation)
                
                # Collect guardrail event for later
                if "guardrail" in stream_event:
                    guardrail_action = stream_event["guardrail"].get("action")
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # After all text is streamed, send metadata
        if all_citations:
            yield f"event: citations\ndata: {json.dumps({'citations': all_citations})}\n\n"
        
        if guardrail_action:
            yield f"event: guardrail\ndata: {json.dumps({'action': guardrail_action})}\n\n"
        
        # Save conversation to DynamoDB (async, don't block response)
        save_conversation_to_dynamodb(
            conversation_id=conversation_id,
            session_id=response_session_id or session_id,
            question=query,
            answer=full_response_text,
            citations=all_citations,
            response_time_ms=response_time_ms,
            language=language
        )
        
        # Send done event with conversation ID and response time
        yield f"event: done\ndata: {json.dumps({'status': 'complete', 'conversationId': conversation_id, 'responseTimeMs': response_time_ms})}\n\n"
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error streaming from Bedrock: {error_msg}")
        yield f"event: error\ndata: {json.dumps({'error': error_msg})}\n\n"


def format_citation(citation: dict) -> dict:
    """
    Format a single citation from the RetrieveAndGenerateStream response.
    
    Security: Only includes S3 references from the public/ folder.
    S3 URIs are converted to public HTTPS URLs.
    Private S3 content and supplemental bucket content are filtered out.
    """
    formatted = {
        "retrievedReferences": []
    }
    
    retrieved_references = citation.get("retrievedReferences", [])
    
    for ref in retrieved_references:
        location = ref.get("location", {})
        location_type = location.get("type", "")
        
        # Handle S3 locations - only include public/ folder content
        if location_type == "S3":
            s3_location = location.get("s3Location", {})
            s3_uri = s3_location.get("uri", "")
            
            # Convert to public URL - returns None if not in public/ folder
            public_url = s3_uri_to_public_url(s3_uri)
            
            if public_url:
                # Only include if it's from the public folder
                formatted_ref = {
                    "content": {},
                    "location": {
                        "type": "S3",
                        "url": public_url,  # Use public HTTPS URL instead of S3 URI
                    },
                    "metadata": ref.get("metadata", {}),
                }
                
                # Extract content
                content = ref.get("content", {})
                if "text" in content:
                    formatted_ref["content"]["text"] = content["text"]
                
                formatted["retrievedReferences"].append(formatted_ref)
            # else: Skip private S3 content (not in public/ folder)
        
        # Handle WEB locations - always include (from web crawler)
        elif location_type == "WEB":
            web_location = location.get("webLocation", {})
            web_url = web_location.get("url", "")
            
            if web_url:
                formatted_ref = {
                    "content": {},
                    "location": {
                        "type": "WEB",
                        "url": web_url,
                    },
                    "metadata": ref.get("metadata", {}),
                }
                
                # Extract content
                content = ref.get("content", {})
                if "text" in content:
                    formatted_ref["content"]["text"] = content["text"]
                
                formatted["retrievedReferences"].append(formatted_ref)
    
    return formatted


@app.get("/{request_path:path}")
async def catch_all(request: Request, request_path: str):
    """Catch-all route to handle all GET requests (health check, etc.)"""
    return {"status": "healthy", "knowledgeBaseId": KNOWLEDGE_BASE_ID}


@app.post("/feedback")
async def submit_feedback(request: Request):
    """
    Submit feedback for a conversation.
    
    Request body:
    {
        "conversationId": "string" (required),
        "feedback": "pos" | "neg" (required)
    }
    
    Response:
    {
        "success": true,
        "conversationId": "string",
        "feedback": "string"
    }
    """
    if not CONVERSATION_HISTORY_TABLE:
        return JSONResponse(
            status_code=500,
            content={"error": "Feedback storage not configured"}
        )
    
    try:
        body = await request.body()
        payload = json.loads(body.decode('utf-8'))
        
        conversation_id = payload.get("conversationId")
        feedback = payload.get("feedback")
        
        if not conversation_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing required parameter: conversationId"}
            )
        
        # Accept multiple formats and normalize to pos/neg
        if feedback in ["positive", "+"]:
            feedback = "pos"
        elif feedback in ["negative", "-"]:
            feedback = "neg"
        
        if feedback not in ["pos", "neg"]:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid feedback value. Must be 'pos' or 'neg'"}
            )
        
        table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
        
        # First, we need to find the item by conversationId
        # Since timestamp is the sort key, we need to query
        response = table.query(
            KeyConditionExpression="conversationId = :cid",
            ExpressionAttributeValues={":cid": conversation_id},
            Limit=1
        )
        
        if not response.get("Items"):
            return JSONResponse(
                status_code=404,
                content={"error": "Conversation not found"}
            )
        
        item = response["Items"][0]
        timestamp = item["timestamp"]
        
        # Update the feedback (pos or neg)
        feedback_timestamp = datetime.now(timezone.utc).isoformat()
        
        table.update_item(
            Key={
                "conversationId": conversation_id,
                "timestamp": timestamp
            },
            UpdateExpression="SET feedback = :fb, feedbackTs = :fbt",
            ExpressionAttributeValues={
                ":fb": feedback,
                ":fbt": feedback_timestamp
            }
        )
        
        print(f"Updated feedback for conversation {conversation_id}: {feedback}")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "conversationId": conversation_id,
                "feedback": feedback
            }
        )
        
    except Exception as e:
        print(f"Error submitting feedback: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.post("/{request_path:path}")
async def chat(request: Request):
    """
    Chat endpoint that streams responses from Bedrock Knowledge Base.
    
    Uses Server-Sent Events (SSE) for streaming.
    
    Request body:
    {
        "query": "string" (required),
        "sessionId": "string" (optional),
        "numberOfResults": number (optional, default: 5),
        "language": "string" (optional, default: "en")
    }
    
    Event order:
    1. conversationId: { "conversationId": "uuid" } (for feedback tracking)
    2. sessionId: { "sessionId": "string" }
    3. text: { "text": "chunk..." } (multiple, streamed)
    4. citations: { "citations": [...] } (once, at the end)
    5. guardrail: { "action": "string" } (if applicable)
    6. done: { "status": "complete", "conversationId": "uuid", "responseTimeMs": number }
    
    Or on error:
    - error: { "error": "string" }
    """
    
    # Parse request body
    body = await request.body()
    payload = json.loads(body.decode('utf-8'))
    
    query = payload.get("query")
    if not query:
        return {"error": "Missing required parameter: query"}
    
    session_id = payload.get("sessionId")
    number_of_results = payload.get("numberOfResults", 5)
    language = payload.get("language", "en")
    
    return StreamingResponse(
        stream_kb_response(
            query=query,
            session_id=session_id,
            number_of_results=number_of_results,
            language=language,
        ),
        media_type="text/event-stream",
    )
