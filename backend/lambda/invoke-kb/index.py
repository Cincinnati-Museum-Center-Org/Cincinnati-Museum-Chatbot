"""
Lambda function to invoke Bedrock Knowledge Base with RetrieveAndGenerateStream API.

API Reference:
- RetrieveAndGenerateStream: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_RetrieveAndGenerateStream.html
"""

import json
import os
import boto3

# Initialize Bedrock Agent Runtime client
bedrock_agent_runtime = boto3.client("bedrock-agent-runtime")

# Environment variables
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID")

# Using global inference profile for cross-region support
MODEL_ID = "global.amazon.nova-2-lite-v1:0"


def create_response(status_code: int, body: dict) -> dict:
    """Create a standardized API response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def format_citations(citations: list) -> list:
    """
    Format citations from the RetrieveAndGenerateStream response.
    
    Citation structure per AWS API:
    {
        "generatedResponsePart": {
            "textResponsePart": {
                "span": { "end": number, "start": number },
                "text": "string"
            }
        },
        "retrievedReferences": [
            {
                "content": { "text": "string" },
                "location": {
                    "type": "string",
                    "s3Location": { "uri": "string" },
                    "webLocation": { "url": "string" }
                },
                "metadata": { "string": JSON value }
            }
        ]
    }
    """
    formatted_citations = []
    
    for citation in citations:
        retrieved_references = citation.get("retrievedReferences", [])
        generated_response_part = citation.get("generatedResponsePart", {})
        
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
            
            # Include generated response part span if available
            if generated_response_part:
                text_response_part = generated_response_part.get("textResponsePart", {})
                if text_response_part:
                    formatted_ref["generatedResponseSpan"] = text_response_part.get("span", {})
            
            formatted_citations.append(formatted_ref)
    
    return formatted_citations


def handler(event, context):
    """
    Lambda handler for invoking Bedrock Knowledge Base with RetrieveAndGenerateStream.
    
    Request body format:
    {
        "query": "string" (required),
        "sessionId": "string" (optional),
        "numberOfResults": number (optional, default: 5)
    }
    
    Response format:
    {
        "output": { "text": "string" },
        "citations": [...],
        "sessionId": "string",
        "guardrailAction": "string"
    }
    """
    
    print(f"Received event: {json.dumps(event)}")
    
    # Validate environment
    if not KNOWLEDGE_BASE_ID:
        return create_response(500, {
            "error": "KNOWLEDGE_BASE_ID environment variable not set"
        })
    
    # Parse request body
    try:
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        else:
            body = event.get("body", event)
    except json.JSONDecodeError as e:
        return create_response(400, {
            "error": f"Invalid JSON in request body: {str(e)}"
        })
    
    # Extract parameters
    query = body.get("query")
    if not query:
        return create_response(400, {
            "error": "Missing required parameter: query"
        })
    
    session_id = body.get("sessionId")
    number_of_results = body.get("numberOfResults", 5)
    
    # Build request per AWS API specification
    # POST /retrieveAndGenerateStream
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
        
        # Process streaming response
        # Session ID is returned in header: x-amzn-bedrock-knowledge-base-session-id
        chunks = []
        citations = []
        guardrail_action = None
        
        stream = response.get("stream")
        if stream:
            for stream_event in stream:
                # Handle output event: { "text": "string" }
                if "output" in stream_event:
                    output = stream_event["output"]
                    if "text" in output:
                        chunks.append(output["text"])
                
                # Handle citation event
                if "citation" in stream_event:
                    citations.append(stream_event["citation"])
                
                # Handle guardrail event: { "action": "string" }
                if "guardrail" in stream_event:
                    guardrail_action = stream_event["guardrail"].get("action")
        
        # Get session ID from response metadata
        session_id_response = response.get("sessionId")
        
        return create_response(200, {
            "output": {
                "text": "".join(chunks)
            },
            "citations": format_citations(citations),
            "sessionId": session_id_response,
            "guardrailAction": guardrail_action
        })
            
    except bedrock_agent_runtime.exceptions.ValidationException as e:
        print(f"ValidationException: {str(e)}")
        return create_response(400, {
            "error": f"Validation error: {str(e)}"
        })
    except bedrock_agent_runtime.exceptions.ResourceNotFoundException as e:
        print(f"ResourceNotFoundException: {str(e)}")
        return create_response(404, {
            "error": f"Resource not found: {str(e)}"
        })
    except bedrock_agent_runtime.exceptions.ThrottlingException as e:
        print(f"ThrottlingException: {str(e)}")
        return create_response(429, {
            "error": "Too many requests. Please try again later."
        })
    except bedrock_agent_runtime.exceptions.AccessDeniedException as e:
        print(f"AccessDeniedException: {str(e)}")
        return create_response(403, {
            "error": f"Access denied: {str(e)}"
        })
    except bedrock_agent_runtime.exceptions.ConflictException as e:
        print(f"ConflictException: {str(e)}")
        return create_response(409, {
            "error": f"Conflict: {str(e)}"
        })
    except bedrock_agent_runtime.exceptions.DependencyFailedException as e:
        print(f"DependencyFailedException: {str(e)}")
        return create_response(424, {
            "error": f"Dependency failed: {str(e)}"
        })
    except bedrock_agent_runtime.exceptions.ServiceQuotaExceededException as e:
        print(f"ServiceQuotaExceededException: {str(e)}")
        return create_response(400, {
            "error": "Service quota exceeded. Please try again later."
        })
    except bedrock_agent_runtime.exceptions.BadGatewayException as e:
        print(f"BadGatewayException: {str(e)}")
        return create_response(502, {
            "error": f"Bad gateway: {str(e)}"
        })
    except bedrock_agent_runtime.exceptions.InternalServerException as e:
        print(f"InternalServerException: {str(e)}")
        return create_response(500, {
            "error": "Internal server error. Please retry your request."
        })
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return create_response(500, {
            "error": f"Internal server error: {str(e)}"
        })
