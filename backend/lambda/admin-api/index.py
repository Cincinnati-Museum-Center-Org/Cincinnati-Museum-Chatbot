"""
Admin API Lambda for dashboard analytics and conversation management.
Provides endpoints for:
- Dashboard statistics (total conversations, satisfaction rate, response times)
- Conversation listing and filtering
- Feedback summary
"""

import os
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key, Attr

# Initialize DynamoDB
dynamodb = boto3.resource("dynamodb")
CONVERSATION_HISTORY_TABLE = os.environ.get("CONVERSATION_HISTORY_TABLE")


class DecimalEncoder(json.JSONEncoder):
    """Handle Decimal types from DynamoDB."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super().default(obj)


def json_response(status_code: int, body: dict) -> dict:
    """Create API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def get_stats(event: dict) -> dict:
    """
    Get dashboard statistics.
    
    Query params:
    - days: Number of days to look back (default: 7)
    
    Returns:
    - totalConversations: Total number of conversations
    - conversationsToday: Conversations in the last 24 hours
    - totalFeedback: Number of conversations with feedback
    - positiveFeedback: Number of positive feedbacks
    - negativeFeedback: Number of negative feedbacks
    - satisfactionRate: Percentage of positive feedback
    - avgResponseTime: Average response time in ms
    - conversationsByDay: Array of {date, count} for the period
    """
    table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
    
    # Get query parameters
    params = event.get("queryStringParameters") or {}
    days = int(params.get("days", 7))
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")
    
    # Query conversations by date
    conversations_by_day = {}
    total_conversations = 0
    total_feedback = 0
    positive_feedback = 0
    negative_feedback = 0
    total_response_time = 0
    response_time_count = 0
    conversations_today = 0
    
    # Scan the table (for small datasets; use GSI for larger)
    # In production, you'd want to use the date-timestamp-index GSI
    response = table.scan()
    items = response.get("Items", [])
    
    # Handle pagination
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    
    for item in items:
        item_date = item.get("date", "")
        
        # Count by day
        if item_date >= start_date:
            conversations_by_day[item_date] = conversations_by_day.get(item_date, 0) + 1
            total_conversations += 1
            
            # Today's count
            if item_date == today:
                conversations_today += 1
            
            # Feedback stats
            feedback = item.get("feedback")
            if feedback:
                total_feedback += 1
                if feedback == "pos":
                    positive_feedback += 1
                elif feedback == "neg":
                    negative_feedback += 1
            
            # Response time
            response_time = item.get("responseTimeMs")
            if response_time:
                total_response_time += response_time
                response_time_count += 1
    
    # Calculate satisfaction rate
    satisfaction_rate = 0
    if total_feedback > 0:
        satisfaction_rate = round((positive_feedback / total_feedback) * 100, 1)
    
    # Calculate average response time
    avg_response_time = 0
    if response_time_count > 0:
        avg_response_time = round(total_response_time / response_time_count)
    
    # Format conversations by day for chart
    conversations_chart = []
    current_date = now - timedelta(days=days-1)
    for _ in range(days):
        date_str = current_date.strftime("%Y-%m-%d")
        conversations_chart.append({
            "date": date_str,
            "count": conversations_by_day.get(date_str, 0),
            "dayName": current_date.strftime("%a"),
        })
        current_date += timedelta(days=1)
    
    return json_response(200, {
        "totalConversations": total_conversations,
        "conversationsToday": conversations_today,
        "totalFeedback": total_feedback,
        "positiveFeedback": positive_feedback,
        "negativeFeedback": negative_feedback,
        "noFeedback": total_conversations - total_feedback,
        "satisfactionRate": satisfaction_rate,
        "avgResponseTimeMs": avg_response_time,
        "conversationsByDay": conversations_chart,
        "period": {
            "days": days,
            "startDate": start_date,
            "endDate": today,
        },
    })


def get_conversations(event: dict) -> dict:
    """
    Get list of conversations with filtering and pagination.
    
    Query params:
    - feedback: Filter by feedback type (pos, neg, none)
    - date: Filter by specific date (YYYY-MM-DD)
    - limit: Max results (default: 20)
    - offset: Skip this many results (for pagination)
    """
    table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
    
    params = event.get("queryStringParameters") or {}
    feedback_filter = params.get("feedback")
    date_filter = params.get("date")
    limit = int(params.get("limit", 20))
    offset = int(params.get("offset", 0))
    
    # Build scan parameters - fetch more than needed for filtering
    scan_kwargs = {}
    
    # Add filters
    filter_expressions = []
    expression_values = {}
    expression_names = {}
    
    if feedback_filter:
        if feedback_filter == "none":
            filter_expressions.append("attribute_not_exists(feedback)")
        else:
            filter_expressions.append("feedback = :fb")
            expression_values[":fb"] = feedback_filter
    
    if date_filter:
        filter_expressions.append("#d = :dt")
        expression_values[":dt"] = date_filter
        expression_names["#d"] = "date"
    
    if filter_expressions:
        scan_kwargs["FilterExpression"] = " AND ".join(filter_expressions)
        if expression_values:
            scan_kwargs["ExpressionAttributeValues"] = expression_values
        if expression_names:
            scan_kwargs["ExpressionAttributeNames"] = expression_names
    
    # Execute scan and get all matching items
    all_items = []
    response = table.scan(**scan_kwargs)
    all_items.extend(response.get("Items", []))
    
    # Handle pagination for large datasets
    while "LastEvaluatedKey" in response:
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        response = table.scan(**scan_kwargs)
        all_items.extend(response.get("Items", []))
    
    # Sort by timestamp descending
    all_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Apply offset and limit
    paginated_items = all_items[offset:offset + limit]
    has_more = (offset + limit) < len(all_items)
    
    # Format response
    conversations = []
    for item in paginated_items:
        conversations.append({
            "conversationId": item.get("conversationId"),
            "sessionId": item.get("sessionId"),
            "timestamp": item.get("timestamp"),
            "date": item.get("date"),
            "question": item.get("question", "")[:100] + "..." if len(item.get("question", "")) > 100 else item.get("question", ""),
            "answerPreview": item.get("answer", "")[:150] + "..." if len(item.get("answer", "")) > 150 else item.get("answer", ""),
            "feedback": item.get("feedback"),
            "responseTimeMs": item.get("responseTimeMs"),
            "citationCount": item.get("citationCount", 0),
            "language": item.get("language", "en"),
        })
    
    return json_response(200, {
        "conversations": conversations,
        "count": len(conversations),
        "total": len(all_items),
        "offset": offset,
        "limit": limit,
        "hasMore": has_more,
    })


def get_conversation_by_id(event: dict) -> dict:
    """Get a single conversation by ID with full details."""
    table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
    
    conversation_id = event.get("pathParameters", {}).get("conversationId")
    if not conversation_id:
        return json_response(400, {"error": "Missing conversationId"})
    
    # Query by conversationId
    response = table.query(
        KeyConditionExpression=Key("conversationId").eq(conversation_id),
        Limit=1,
    )
    
    items = response.get("Items", [])
    if not items:
        return json_response(404, {"error": "Conversation not found"})
    
    item = items[0]
    
    # Parse citations JSON
    citations = []
    try:
        citations = json.loads(item.get("citations", "[]"))
    except:
        pass
    
    return json_response(200, {
        "conversationId": item.get("conversationId"),
        "sessionId": item.get("sessionId"),
        "timestamp": item.get("timestamp"),
        "date": item.get("date"),
        "question": item.get("question"),
        "answer": item.get("answer"),
        "citations": citations,
        "citationCount": item.get("citationCount", 0),
        "feedback": item.get("feedback"),
        "feedbackTs": item.get("feedbackTs"),
        "responseTimeMs": item.get("responseTimeMs"),
        "modelId": item.get("modelId"),
        "language": item.get("language"),
        "questionLength": item.get("questionLength"),
        "answerLength": item.get("answerLength"),
    })


def get_feedback_summary(event: dict) -> dict:
    """
    Get feedback summary with recent negative feedback for review.
    """
    table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
    
    params = event.get("queryStringParameters") or {}
    days = int(params.get("days", 30))
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    
    # Scan for feedback data
    response = table.scan()
    items = response.get("Items", [])
    
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    
    # Filter and categorize
    positive = []
    negative = []
    no_feedback = 0
    
    for item in items:
        if item.get("date", "") < start_date:
            continue
            
        feedback = item.get("feedback")
        if feedback == "pos":
            positive.append(item)
        elif feedback == "neg":
            negative.append({
                "conversationId": item.get("conversationId"),
                "timestamp": item.get("timestamp"),
                "question": item.get("question"),
                "answerPreview": item.get("answer", "")[:200],
                "feedbackTs": item.get("feedbackTs"),
            })
        else:
            no_feedback += 1
    
    # Sort negative by timestamp descending
    negative.sort(key=lambda x: x.get("feedbackTs") or x.get("timestamp", ""), reverse=True)
    
    return json_response(200, {
        "summary": {
            "positive": len(positive),
            "negative": len(negative),
            "noFeedback": no_feedback,
            "total": len(positive) + len(negative) + no_feedback,
            "satisfactionRate": round((len(positive) / (len(positive) + len(negative))) * 100, 1) if (len(positive) + len(negative)) > 0 else 0,
        },
        "recentNegative": negative[:10],  # Top 10 most recent negative
        "period": {
            "days": days,
            "startDate": start_date,
        },
    })


def handler(event, context):
    """Main Lambda handler - routes requests to appropriate functions."""
    
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    
    print(f"Admin API: {http_method} {path}")
    
    # Handle OPTIONS for CORS
    if http_method == "OPTIONS":
        return json_response(200, {})
    
    # Route requests
    if http_method == "GET":
        if "/admin/stats" in path:
            return get_stats(event)
        elif "/admin/feedback-summary" in path:
            return get_feedback_summary(event)
        elif "/admin/conversations/" in path:
            return get_conversation_by_id(event)
        elif "/admin/conversations" in path:
            return get_conversations(event)
    
    return json_response(404, {"error": "Not found"})
