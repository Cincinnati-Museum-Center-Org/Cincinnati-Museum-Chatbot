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
    expose_headers=["*"],
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
    
    print(f"[{conversation_id}] New query: '{query[:100]}...' | language={language} | session={session_id}")
    
    # Model for implicit filtering - using Claude 3.5 Sonnet for better filter generation
    IMPLICIT_FILTER_MODEL = "us.anthropic.claude-3-5-sonnet-20240620-v1:0"
    
    # Build knowledge base configuration
    kb_config = {
        "knowledgeBaseId": KNOWLEDGE_BASE_ID,
        "modelArn": MODEL_ID,
        "retrievalConfiguration": {
            "vectorSearchConfiguration": {
                "numberOfResults": number_of_results,
                # Use hybrid search (semantic + text) for better accuracy
                "overrideSearchType": "HYBRID",
                # Implicit metadata filtering - model auto-generates filters based on query
                "implicitFilterConfiguration": {
                    "modelArn": IMPLICIT_FILTER_MODEL,
                    "metadataAttributes": [
                        {
                            "key": "x-amz-bedrock-kb-source-uri",
                            "type": "STRING",
                            "description": "The source URL of the content. URLs containing 'event-processing' are for live events, upcoming programs, and current happenings at the Cincinnati Museum Center."
                        }
                    ]
                }
            }
        },
        # Enable query decomposition for complex queries
        "orchestrationConfiguration": {
            "queryTransformationConfiguration": {
                "type": "QUERY_DECOMPOSITION"
            }
        }
    }
    
    # Generation prompt templates with time context
    # NOTE: $output_format_instructions$ is REQUIRED for citations to be displayed
    # NOTE: $search_results$ contains the retrieved documents
    # NOTE: $current_time$ is automatically replaced by Bedrock with the current timestamp
    
    if language == "es":
        # Spanish generation prompt
        kb_config["generationConfiguration"] = {
            "promptTemplate": {
                "textPromptTemplate": """
Eres un agente de respuesta a preguntas. Te proporcionaré un conjunto de resultados de búsqueda. El usuario te hará una pregunta. Tu trabajo es responder la pregunta del usuario usando SOLO información de los resultados de búsqueda. Si los resultados de búsqueda no contienen información que pueda responder la pregunta, responde exactamente:
"Has hecho una excelente pregunta, pero es algo para lo que aún no tengo los detalles. Para obtener la información más precisa, comunícate con nuestro equipo al (513) 287-7000."
IMPORTANTE: DEBES responder ÚNICAMENTE en español. No uses inglés bajo ninguna circunstancia.
FECHA Y HORA ACTUAL: $current_time$

Para saludos generales (hola, buenos días, etc.) responde de manera amigable y ofrece ayuda con información sobre el museo.

Aquí están los resultados de búsqueda en orden numerado:
$search_results$

$output_format_instructions$"""
            }
        }
    else:
        # English generation prompt (default)
        kb_config["generationConfiguration"] = {
            "promptTemplate": {
                "textPromptTemplate": """You are a virtual assistant for the Cincinnati Museum Center (CMC). Your role is to help visitors by answering questions about the museum, its exhibitions, events, schedules, and services.

CURRENT DATE AND TIME: $current_time$

INSTRUCTIONS:
- For general greetings (hello, hi, hey, etc.) respond in a friendly manner and offer to help with museum information.
- Use information from the provided search results to answer questions about the museum.
- If the search results don't contain enough information to answer a specific museum-related question, respond exactly: "You've asked a great question, but it's one I don't have the details for just yet. For the most accurate information, please contact our team at (513) 287-7000."
- When asked about events or what's happening, share upcoming events from the search results even if they are in the future. Indicate the dates clearly.

Search results:
$search_results$

$output_format_instructions$"""
            }
        }
    
    # Build request per AWS API specification
    request_params = {
        "input": {
            "text": query
        },
        "retrieveAndGenerateConfiguration": {
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": kb_config
        }
    }
    
    # Only use session ID if it looks like a valid Bedrock session ID
    # Bedrock session IDs are UUIDs, not our custom format
    use_session_id = None
    if session_id and not session_id.startswith("session-"):
        use_session_id = session_id
        request_params["sessionId"] = use_session_id
    
    try:
        # Send conversation ID as first event (for feedback tracking)
        yield f"event: conversationId\ndata: {json.dumps({'conversationId': conversation_id})}\n\n"

        # Call RetrieveAndGenerateStream API
        max_retries = 3
        backoff_base = 0.5  # seconds
        response = None
        for attempt in range(max_retries):
            try:
                response = bedrock_agent_runtime.retrieve_and_generate_stream(**request_params)
                break
            except Exception as e:
                error_msg = str(e)
                # Handle throttling
                if "ThrottlingException" in error_msg or "rate is too high" in error_msg:
                    if attempt < max_retries - 1:
                        sleep_time = backoff_base * (2 ** attempt)
                        print(f"Throttling detected, retrying in {sleep_time:.2f}s (attempt {attempt+1}/{max_retries})")
                        time.sleep(sleep_time)
                        continue
                    else:
                        # Send error event to frontend
                        yield f"event: error\ndata: {{\"error\": \"Bedrock API throttling: {error_msg}\"}}\n\n"
                        response = None
                        break
                # If session is invalid/expired, retry without session ID
                elif "Session with Id" in error_msg and "is not valid" in error_msg:
                    print(f"Session expired, retrying without session ID: {use_session_id}")
                    if "sessionId" in request_params:
                        del request_params["sessionId"]
                    # Notify frontend to clear session
                    yield f"event: sessionExpired\ndata: {json.dumps({'message': 'Session expired, starting new session'})}\n\n"
                    # Retry immediately (no backoff for session expired)
                    continue
                else:
                    raise
        if response is None:
            raise RuntimeError("Failed to get response from Bedrock after retries.")

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

        print(f"[{conversation_id}] Response complete | {response_time_ms}ms | {len(all_citations)} citations | {len(full_response_text)} chars")

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
        print(f"[{conversation_id}] Error: {error_msg}")
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
