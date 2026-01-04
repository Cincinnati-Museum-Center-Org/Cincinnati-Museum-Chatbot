"""
Lambda function for CRUD operations on User Information DynamoDB table.

Supports:
- POST /users - Create a new user record
- GET /users/{userId} - Get user record(s) by userId
- GET /users/{userId}?createdAt=timestamp - Get specific user record
- PUT /users/{userId} - Update user record (requires createdAt in body)
- DELETE /users/{userId} - Delete user record (requires createdAt in body)
"""

import json
import os
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

# Initialize DynamoDB client
dynamodb = boto3.resource("dynamodb")

# Environment variables
USER_TABLE_NAME = os.environ.get("USER_TABLE_NAME")


def create_response(status_code: int, body: dict, headers: dict = None) -> dict:
    """Create a standardized API response."""
    default_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    
    if headers:
        default_headers.update(headers)
    
    return {
        "statusCode": status_code,
        "headers": default_headers,
        "body": json.dumps(body, default=decimal_default),
    }


def decimal_default(obj):
    """Convert Decimal to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def parse_event(event):
    """Parse API Gateway REST API event to extract method, path, and body."""
    # API Gateway REST API format
    method = event.get("httpMethod")
    path = event.get("path")
    path_parameters = event.get("pathParameters") or {}
    query_parameters = event.get("queryStringParameters") or {}
    
    # Parse body
    body = {}
    if event.get("body"):
        try:
            if isinstance(event["body"], str):
                body = json.loads(event["body"])
            else:
                body = event["body"]
        except json.JSONDecodeError:
            pass
    
    return {
        "method": method,
        "path": path,
        "pathParameters": path_parameters,
        "queryParameters": query_parameters,
        "body": body,
    }


def create_user(table, user_id: str, user_data: dict) -> dict:
    """Create a new user record."""
    # Generate timestamp for createdAt if not provided
    created_at = user_data.get("createdAt")
    if not created_at:
        created_at = datetime.utcnow().isoformat() + "Z"
    
    # Prepare item
    item = {
        "userId": user_id,
        "createdAt": created_at,
    }
    
    # Add additional user data (exclude userId and createdAt from body)
    for key, value in user_data.items():
        if key not in ["userId", "createdAt"]:
            item[key] = value
    
    try:
        table.put_item(Item=item)
        return create_response(201, {
            "message": "User created successfully",
            "user": item,
        })
    except ClientError as e:
        print(f"DynamoDB error: {str(e)}")
        return create_response(500, {
            "error": f"Failed to create user: {str(e)}"
        })


def get_user(table, user_id: str, created_at: str = None) -> dict:
    """Get user record(s)."""
    try:
        if created_at:
            # Get specific record
            response = table.get_item(
                Key={
                    "userId": user_id,
                    "createdAt": created_at,
                }
            )
            
            if "Item" not in response:
                return create_response(404, {
                    "error": f"User record not found for userId: {user_id}, createdAt: {created_at}"
                })
            
            return create_response(200, {
                "user": response["Item"],
            })
        else:
            # Get all records for userId
            response = table.query(
                KeyConditionExpression="userId = :userId",
                ExpressionAttributeValues={
                    ":userId": user_id,
                }
            )
            
            users = response.get("Items", [])
            return create_response(200, {
                "users": users,
                "count": len(users),
            })
    except ClientError as e:
        print(f"DynamoDB error: {str(e)}")
        return create_response(500, {
            "error": f"Failed to retrieve user: {str(e)}"
        })


def update_user(table, user_id: str, user_data: dict) -> dict:
    """Update an existing user record."""
    created_at = user_data.get("createdAt")
    if not created_at:
        return create_response(400, {
            "error": "createdAt is required in request body for update operation"
        })
    
    # Build update expression
    update_expression_parts = []
    expression_attribute_names = {}
    expression_attribute_values = {}
    
    for key, value in user_data.items():
        if key not in ["userId", "createdAt"]:
            update_expression_parts.append(f"#{key} = :{key}")
            expression_attribute_names[f"#{key}"] = key
            expression_attribute_values[f":{key}"] = value
    
    if not update_expression_parts:
        return create_response(400, {
            "error": "No fields to update. Provide at least one field besides userId and createdAt."
        })
    
    update_expression = "SET " + ", ".join(update_expression_parts)
    
    try:
        response = table.update_item(
            Key={
                "userId": user_id,
                "createdAt": created_at,
            },
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW",
        )
        
        return create_response(200, {
            "message": "User updated successfully",
            "user": response["Attributes"],
        })
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "ValidationException":
            return create_response(400, {
                "error": f"Validation error: {str(e)}"
            })
        elif error_code == "ResourceNotFoundException":
            return create_response(404, {
                "error": f"User record not found for userId: {user_id}, createdAt: {created_at}"
            })
        else:
            print(f"DynamoDB error: {str(e)}")
            return create_response(500, {
                "error": f"Failed to update user: {str(e)}"
            })


def delete_user(table, user_id: str, created_at: str) -> dict:
    """Delete a user record."""
    if not created_at:
        return create_response(400, {
            "error": "createdAt is required in request body for delete operation"
        })
    
    try:
        table.delete_item(
            Key={
                "userId": user_id,
                "createdAt": created_at,
            }
        )
        
        return create_response(200, {
            "message": "User deleted successfully",
            "userId": user_id,
            "createdAt": created_at,
        })
    except ClientError as e:
        print(f"DynamoDB error: {str(e)}")
        return create_response(500, {
            "error": f"Failed to delete user: {str(e)}"
        })


def handler(event, context):
    """
    Lambda handler for user CRUD operations.
    
    Supported endpoints:
    - POST /users - Create user (userId in body)
    - GET /users/{userId} - Get user(s) (optional createdAt query param)
    - PUT /users/{userId} - Update user (userId in path, createdAt and other fields in body)
    - DELETE /users/{userId} - Delete user (userId in path, createdAt in body)
    """
    
    print(f"Received event: {json.dumps(event)}")
    
    # Validate environment
    if not USER_TABLE_NAME:
        return create_response(500, {
            "error": "USER_TABLE_NAME environment variable not set"
        })
    
    # Get DynamoDB table
    table = dynamodb.Table(USER_TABLE_NAME)
    
    # Parse event
    parsed = parse_event(event)
    method = parsed["method"]
    path_params = parsed["pathParameters"]
    query_params = parsed["queryParameters"]
    body = parsed["body"]
    
    # Extract userId from path parameters
    user_id = path_params.get("userId") if path_params else None
    
    # Handle OPTIONS request for CORS
    if method == "OPTIONS":
        return create_response(200, {})
    
    # Route based on HTTP method
    if method == "POST":
        # Create user - userId should be in body
        user_id = body.get("userId")
        if not user_id:
            return create_response(400, {
                "error": "userId is required in request body"
            })
        return create_user(table, user_id, body)
    
    elif method == "GET":
        # Get user - userId from path, optional createdAt from query
        if not user_id:
            return create_response(400, {
                "error": "userId is required in path"
            })
        created_at = query_params.get("createdAt") if query_params else None
        return get_user(table, user_id, created_at)
    
    elif method == "PUT":
        # Update user - userId from path, createdAt and other fields in body
        if not user_id:
            return create_response(400, {
                "error": "userId is required in path"
            })
        return update_user(table, user_id, body)
    
    elif method == "DELETE":
        # Delete user - userId from path, createdAt in body
        if not user_id:
            return create_response(400, {
                "error": "userId is required in path"
            })
        created_at = body.get("createdAt")
        return delete_user(table, user_id, created_at)
    
    else:
        return create_response(405, {
            "error": f"Method {method} not allowed"
        })

