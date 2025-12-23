"""
Lambda function with FastAPI to invoke Bedrock Knowledge Base with RetrieveAndGenerateStream API.
Uses Lambda Web Adapter Layer for HTTP response streaming to API Gateway.

API Reference:
- RetrieveAndGenerateStream: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_RetrieveAndGenerateStream.html
"""

import os
import json
import boto3
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()

# Initialize Bedrock Agent Runtime client
bedrock_agent_runtime = boto3.client("bedrock-agent-runtime")

# Environment variables
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID")

# Model ID for generation - using global inference profile
MODEL_ID = "global.amazon.nova-2-lite-v1:0"

async def stream_kb_response(query: str, session_id: str = None, number_of_results: int = 5):
    """
    Stream response from Bedrock Knowledge Base using RetrieveAndGenerateStream API.
    
    Streams text chunks first, then sends all citations/metadata at the end.
    
    Event order:
    1. sessionId (if available)
    2. text chunks (streamed as they arrive)
    3. metadata (citations, guardrail) at the end
    4. done
    """
    
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
        # Call RetrieveAndGenerateStream API
        response = bedrock_agent_runtime.retrieve_and_generate_stream(**request_params)
        
        # Get session ID from response
        response_session_id = response.get("sessionId")
        
        # Send session ID as first event
        if response_session_id:
            yield f"event: sessionId\ndata: {json.dumps({'sessionId': response_session_id})}\n\n"
        
        # Collect citations and guardrail to send at the end
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
                        yield f"event: text\ndata: {json.dumps({'text': output['text']})}\n\n"
                
                # Collect citation events for later
                if "citation" in stream_event:
                    citation = stream_event["citation"]
                    formatted_citation = format_citation(citation)
                    all_citations.append(formatted_citation)
                
                # Collect guardrail event for later
                if "guardrail" in stream_event:
                    guardrail_action = stream_event["guardrail"].get("action")
        
        # After all text is streamed, send metadata
        if all_citations:
            yield f"event: citations\ndata: {json.dumps({'citations': all_citations})}\n\n"
        
        if guardrail_action:
            yield f"event: guardrail\ndata: {json.dumps({'action': guardrail_action})}\n\n"
        
        # Send done event
        yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error streaming from Bedrock: {error_msg}")
        yield f"event: error\ndata: {json.dumps({'error': error_msg})}\n\n"


def format_citation(citation: dict) -> dict:
    """
    Format a single citation from the RetrieveAndGenerateStream response.
    """
    formatted = {
        "retrievedReferences": []
    }
    
    retrieved_references = citation.get("retrievedReferences", [])
    
    for ref in retrieved_references:
        formatted_ref = {
            "content": {},
            "location": {},
            "metadata": ref.get("metadata", {}),
        }
        
        # Extract content
        content = ref.get("content", {})
        if "text" in content:
            formatted_ref["content"]["text"] = content["text"]
        
        # Extract location (S3 or WEB)
        location = ref.get("location", {})
        location_type = location.get("type", "")
        formatted_ref["location"]["type"] = location_type
        
        if location_type == "S3":
            s3_location = location.get("s3Location", {})
            formatted_ref["location"]["uri"] = s3_location.get("uri", "")
        elif location_type == "WEB":
            web_location = location.get("webLocation", {})
            formatted_ref["location"]["url"] = web_location.get("url", "")
        
        formatted["retrievedReferences"].append(formatted_ref)
    
    return formatted


@app.get("/{request_path:path}")
async def catch_all(request: Request, request_path: str):
    """Catch-all route to handle all GET requests (health check, etc.)"""
    return {"status": "healthy", "knowledgeBaseId": KNOWLEDGE_BASE_ID}


@app.post("/{request_path:path}")
async def chat(request: Request):
    """
    Chat endpoint that streams responses from Bedrock Knowledge Base.
    
    Uses Server-Sent Events (SSE) for streaming.
    
    Request body:
    {
        "query": "string" (required),
        "sessionId": "string" (optional),
        "numberOfResults": number (optional, default: 5)
    }
    
    Event order:
    1. sessionId: { "sessionId": "string" }
    2. text: { "text": "chunk..." } (multiple, streamed)
    3. citations: { "citations": [...] } (once, at the end)
    4. guardrail: { "action": "string" } (if applicable)
    5. done: { "status": "complete" }
    
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
    
    return StreamingResponse(
        stream_kb_response(
            query=query,
            session_id=session_id,
            number_of_results=number_of_results,
        ),
        media_type="text/event-stream",
    )
