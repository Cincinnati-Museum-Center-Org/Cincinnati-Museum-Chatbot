"""
Admin API Lambda for dashboard analytics and conversation management.

OPTIMIZATIONS:
- Parallel queries using ThreadPoolExecutor for concurrent date queries
- COUNT-only queries for statistics (no full item fetches)
- In-memory caching with TTL for repeated requests
- Minimal data projection to reduce transfer size
"""

import os
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
import time
import boto3
from boto3.dynamodb.conditions import Key, Attr

# Initialize DynamoDB
dynamodb = boto3.resource("dynamodb")
CONVERSATION_HISTORY_TABLE = os.environ.get("CONVERSATION_HISTORY_TABLE")
USER_TABLE_NAME = os.environ.get("USER_TABLE_NAME")

# GSI names from environment variables
DATE_INDEX = os.environ.get("DATE_INDEX", "date-timestamp-index")
FEEDBACK_INDEX = os.environ.get("FEEDBACK_INDEX", "feedback-timestamp-index")

# Cache configuration
CACHE_TTL_SECONDS = 60  # Cache stats for 60 seconds
_stats_cache = {}
_cache_timestamp = {}


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
            "Cache-Control": "max-age=30",  # Client-side caching
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def get_cache_key(prefix: str, start_date: str, end_date: str) -> str:
    """Generate cache key."""
    return f"{prefix}:{start_date}:{end_date}"


def get_cached_result(cache_key: str):
    """Get cached result if not expired."""
    if cache_key in _stats_cache:
        if time.time() - _cache_timestamp.get(cache_key, 0) < CACHE_TTL_SECONDS:
            return _stats_cache[cache_key]
        else:
            # Expired - clean up
            del _stats_cache[cache_key]
            del _cache_timestamp[cache_key]
    return None


def set_cached_result(cache_key: str, result: dict):
    """Cache a result."""
    _stats_cache[cache_key] = result
    _cache_timestamp[cache_key] = time.time()


def query_date_count(table_name: str, date: str) -> dict:
    """
    Query COUNT for a single date using SELECT='COUNT'.
    Returns dict with date and count.
    """
    table = dynamodb.Table(table_name)
    
    total_count = 0
    response = table.query(
        IndexName=DATE_INDEX,
        KeyConditionExpression=Key("date").eq(date),
        Select="COUNT",
    )
    total_count += response.get("Count", 0)
    
    # Handle pagination
    while "LastEvaluatedKey" in response:
        response = table.query(
            IndexName=DATE_INDEX,
            KeyConditionExpression=Key("date").eq(date),
            Select="COUNT",
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        total_count += response.get("Count", 0)
    
    return {"date": date, "count": total_count}


def query_date_stats(table_name: str, date: str) -> dict:
    """
    Query minimal stats for a single date.
    Only fetches: feedback, responseTimeMs (using projection).
    """
    table = dynamodb.Table(table_name)
    
    stats = {
        "date": date,
        "count": 0,
        "positive": 0,
        "negative": 0,
        "no_feedback": 0,
        "total_response_time": 0,
        "response_time_count": 0,
    }
    
    response = table.query(
        IndexName=DATE_INDEX,
        KeyConditionExpression=Key("date").eq(date),
        ProjectionExpression="#fb, responseTimeMs",
        ExpressionAttributeNames={"#fb": "feedback"},
    )
    
    for item in response.get("Items", []):
        stats["count"] += 1
        feedback = item.get("feedback")
        if feedback == "pos":
            stats["positive"] += 1
        elif feedback == "neg":
            stats["negative"] += 1
        else:
            stats["no_feedback"] += 1
        
        response_time = item.get("responseTimeMs")
        if response_time:
            stats["total_response_time"] += int(response_time)
            stats["response_time_count"] += 1
    
    # Handle pagination
    while "LastEvaluatedKey" in response:
        response = table.query(
            IndexName=DATE_INDEX,
            KeyConditionExpression=Key("date").eq(date),
            ProjectionExpression="#fb, responseTimeMs",
            ExpressionAttributeNames={"#fb": "feedback"},
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        for item in response.get("Items", []):
            stats["count"] += 1
            feedback = item.get("feedback")
            if feedback == "pos":
                stats["positive"] += 1
            elif feedback == "neg":
                stats["negative"] += 1
            else:
                stats["no_feedback"] += 1
            
            response_time = item.get("responseTimeMs")
            if response_time:
                stats["total_response_time"] += int(response_time)
                stats["response_time_count"] += 1
    
    return stats


def parallel_query_stats(start_date: str, end_date: str) -> dict:
    """
    Query stats for date range using parallel execution.
    Uses ThreadPoolExecutor for concurrent queries.
    """
    # Generate date list
    dates = []
    current = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    # Aggregate results
    daily_stats = {}
    totals = {
        "count": 0,
        "positive": 0,
        "negative": 0,
        "no_feedback": 0,
        "total_response_time": 0,
        "response_time_count": 0,
    }
    
    # Use ThreadPoolExecutor for parallel queries
    # Limit workers to avoid DynamoDB throttling
    max_workers = min(10, len(dates))
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all queries
        future_to_date = {
            executor.submit(query_date_stats, CONVERSATION_HISTORY_TABLE, date): date
            for date in dates
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_date):
            date = future_to_date[future]
            try:
                stats = future.result()
                daily_stats[date] = stats
                
                # Aggregate totals
                totals["count"] += stats["count"]
                totals["positive"] += stats["positive"]
                totals["negative"] += stats["negative"]
                totals["no_feedback"] += stats["no_feedback"]
                totals["total_response_time"] += stats["total_response_time"]
                totals["response_time_count"] += stats["response_time_count"]
            except Exception as e:
                print(f"Error querying date {date}: {e}")
                daily_stats[date] = {"date": date, "count": 0, "positive": 0, "negative": 0, "no_feedback": 0}
    
    return {
        "daily": daily_stats,
        "totals": totals,
    }


def get_stats(event: dict) -> dict:
    """
    Get dashboard statistics using parallel queries and caching.
    
    OPTIMIZATIONS:
    - Parallel queries for each date
    - Minimal projection (only feedback + responseTimeMs)
    - In-memory caching with 60s TTL
    """
    params = event.get("queryStringParameters") or {}
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    start_date_param = params.get("startDate")
    end_date_param = params.get("endDate")
    
    if start_date_param and end_date_param:
        start_date = start_date_param
        end_date = end_date_param
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        days = (end_dt - start_dt).days + 1
    else:
        days = int(params.get("days", 7))
        start_date = (now - timedelta(days=days-1)).strftime("%Y-%m-%d")
        end_date = today
    
    # Check cache
    cache_key = get_cache_key("stats", start_date, end_date)
    cached = get_cached_result(cache_key)
    if cached:
        print(f"Cache hit for {cache_key}")
        return json_response(200, cached)
    
    print(f"Cache miss - querying {days} days in parallel")
    
    # Query in parallel
    result = parallel_query_stats(start_date, end_date)
    daily_stats = result["daily"]
    totals = result["totals"]
    
    # Calculate derived stats
    total_feedback = totals["positive"] + totals["negative"]
    satisfaction_rate = 0
    if total_feedback > 0:
        satisfaction_rate = round((totals["positive"] / total_feedback) * 100, 1)
    
    avg_response_time = 0
    if totals["response_time_count"] > 0:
        avg_response_time = round(totals["total_response_time"] / totals["response_time_count"])
    
    # Get today's count
    conversations_today = daily_stats.get(today, {}).get("count", 0)
    
    # Build chart data with smart aggregation
    conversations_chart = []
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    
    if days <= 31:
        # Daily data points
        current_date = start_dt
        while current_date <= end_dt:
            date_str = current_date.strftime("%Y-%m-%d")
            count = daily_stats.get(date_str, {}).get("count", 0)
            conversations_chart.append({
                "date": date_str,
                "count": count,
                "dayName": current_date.strftime("%a"),
                "label": current_date.strftime("%-d"),
            })
            current_date += timedelta(days=1)
    
    elif days <= 90:
        # Weekly aggregation
        current_date = start_dt
        while current_date <= end_dt:
            week_end = min(current_date + timedelta(days=6), end_dt)
            week_count = 0
            temp_date = current_date
            while temp_date <= week_end:
                week_count += daily_stats.get(temp_date.strftime("%Y-%m-%d"), {}).get("count", 0)
                temp_date += timedelta(days=1)
            
            conversations_chart.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "endDate": week_end.strftime("%Y-%m-%d"),
                "count": week_count,
                "dayName": f"{current_date.strftime('%b %-d')} - {week_end.strftime('%-d')}",
                "label": current_date.strftime("%b %-d"),
            })
            current_date = week_end + timedelta(days=1)
    
    else:
        # Monthly aggregation
        current_date = start_dt.replace(day=1)
        while current_date <= end_dt:
            if current_date.month == 12:
                month_end = current_date.replace(year=current_date.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                month_end = current_date.replace(month=current_date.month + 1, day=1) - timedelta(days=1)
            
            actual_start = max(current_date, start_dt)
            actual_end = min(month_end, end_dt)
            
            month_count = 0
            temp_date = actual_start
            while temp_date <= actual_end:
                month_count += daily_stats.get(temp_date.strftime("%Y-%m-%d"), {}).get("count", 0)
                temp_date += timedelta(days=1)
            
            conversations_chart.append({
                "date": actual_start.strftime("%Y-%m-%d"),
                "endDate": actual_end.strftime("%Y-%m-%d"),
                "count": month_count,
                "dayName": current_date.strftime("%B %Y"),
                "label": current_date.strftime("%b"),
            })
            
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
    
    response_data = {
        "totalConversations": totals["count"],
        "conversationsToday": conversations_today,
        "totalFeedback": total_feedback,
        "positiveFeedback": totals["positive"],
        "negativeFeedback": totals["negative"],
        "noFeedback": totals["no_feedback"],
        "satisfactionRate": satisfaction_rate,
        "avgResponseTimeMs": avg_response_time,
        "conversationsByDay": conversations_chart,
        "period": {
            "days": days,
            "startDate": start_date,
            "endDate": end_date,
        },
    }
    
    # Cache the result
    set_cached_result(cache_key, response_data)
    
    return json_response(200, response_data)


def get_conversations(event: dict) -> dict:
    """
    Get list of conversations with filtering and pagination.
    Uses GSI for efficient queries.
    """
    table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
    
    params = event.get("queryStringParameters") or {}
    feedback_filter = params.get("feedback")
    start_date = params.get("startDate")
    end_date = params.get("endDate")
    limit = int(params.get("limit", 20))
    offset = int(params.get("offset", 0))
    
    all_items = []
    
    # Projection for listing - only fetch needed fields
    projection = "conversationId, sessionId, #ts, #dt, question, answer, #fb, responseTimeMs, citationCount, #lang"
    expr_names = {
        "#ts": "timestamp",
        "#dt": "date", 
        "#fb": "feedback",
        "#lang": "language",
    }
    
    if feedback_filter and feedback_filter != "none":
        # Use feedback-timestamp-index GSI
        response = table.query(
            IndexName=FEEDBACK_INDEX,
            KeyConditionExpression=Key("feedback").eq(feedback_filter),
            ScanIndexForward=False,
            ProjectionExpression=projection,
            ExpressionAttributeNames=expr_names,
        )
        all_items.extend(response.get("Items", []))
        
        while "LastEvaluatedKey" in response and len(all_items) < offset + limit + 100:
            response = table.query(
                IndexName=FEEDBACK_INDEX,
                KeyConditionExpression=Key("feedback").eq(feedback_filter),
                ExclusiveStartKey=response["LastEvaluatedKey"],
                ScanIndexForward=False,
                ProjectionExpression=projection,
                ExpressionAttributeNames=expr_names,
            )
            all_items.extend(response.get("Items", []))
        
        if start_date and end_date:
            all_items = [
                item for item in all_items
                if start_date <= item.get("date", "") <= end_date
            ]
    
    elif start_date and end_date:
        # Query each date in parallel for better performance
        dates = []
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        while current <= end:
            dates.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
        
        def query_date_items(date):
            items = []
            response = table.query(
                IndexName=DATE_INDEX,
                KeyConditionExpression=Key("date").eq(date),
                ProjectionExpression=projection,
                ExpressionAttributeNames=expr_names,
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = table.query(
                    IndexName=DATE_INDEX,
                    KeyConditionExpression=Key("date").eq(date),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                    ProjectionExpression=projection,
                    ExpressionAttributeNames=expr_names,
                )
                items.extend(response.get("Items", []))
            return items
        
        with ThreadPoolExecutor(max_workers=min(10, len(dates))) as executor:
            futures = [executor.submit(query_date_items, date) for date in dates]
            for future in as_completed(futures):
                try:
                    all_items.extend(future.result())
                except Exception as e:
                    print(f"Error querying: {e}")
        
        if feedback_filter == "none":
            all_items = [item for item in all_items if not item.get("feedback")]
        
        all_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    elif feedback_filter == "none":
        scan_kwargs = {
            "FilterExpression": Attr("feedback").not_exists() | Attr("feedback").eq(None),
            "ProjectionExpression": projection,
            "ExpressionAttributeNames": expr_names,
        }

        response = table.scan(**scan_kwargs)
        all_items.extend(response.get("Items", []))
    
        while "LastEvaluatedKey" in response and len(all_items) < offset + limit + 100:
            scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
            response = table.scan(**scan_kwargs)
            all_items.extend(response.get("Items", []))
    
        all_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    else:
        # Default - last 30 days
        now = datetime.now(timezone.utc)
        default_start = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        default_end = now.strftime("%Y-%m-%d")
        
        dates = []
        current = datetime.strptime(default_start, "%Y-%m-%d")
        end = datetime.strptime(default_end, "%Y-%m-%d")
        while current <= end:
            dates.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
        
        def query_date_items(date):
            items = []
            response = table.query(
                IndexName=DATE_INDEX,
                KeyConditionExpression=Key("date").eq(date),
                ProjectionExpression=projection,
                ExpressionAttributeNames=expr_names,
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = table.query(
                    IndexName=DATE_INDEX,
                    KeyConditionExpression=Key("date").eq(date),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                    ProjectionExpression=projection,
                    ExpressionAttributeNames=expr_names,
                )
                items.extend(response.get("Items", []))
            return items
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(query_date_items, date) for date in dates]
            for future in as_completed(futures):
                try:
                    all_items.extend(future.result())
                except Exception as e:
                    print(f"Error querying: {e}")
        
    all_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Apply pagination
    paginated_items = all_items[offset:offset + limit]
    has_more = (offset + limit) < len(all_items)
    
    # Format response
    conversations = []
    for item in paginated_items:
        question = item.get("question", "")
        answer = item.get("answer", "")
        conversations.append({
            "conversationId": item.get("conversationId"),
            "sessionId": item.get("sessionId"),
            "timestamp": item.get("timestamp"),
            "date": item.get("date"),
            "question": question[:100] + "..." if len(question) > 100 else question,
            "answerPreview": answer[:150] + "..." if len(answer) > 150 else answer,
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
    
    response = table.query(
        KeyConditionExpression=Key("conversationId").eq(conversation_id),
        Limit=1,
    )
    
    items = response.get("Items", [])
    if not items:
        return json_response(404, {"error": "Conversation not found"})
    
    item = items[0]
    
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
    Get feedback summary using parallel queries and caching.
    """
    params = event.get("queryStringParameters") or {}
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    start_date_param = params.get("startDate")
    end_date_param = params.get("endDate")
    
    if start_date_param and end_date_param:
        start_date = start_date_param
        end_date = end_date_param
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        days = (end_dt - start_dt).days + 1
    else:
        days = int(params.get("days", 30))
        start_date = (now - timedelta(days=days-1)).strftime("%Y-%m-%d")
        end_date = today
    
    # Check cache
    cache_key = get_cache_key("feedback", start_date, end_date)
    cached = get_cached_result(cache_key)
    if cached:
        return json_response(200, cached)
    
    # Query stats in parallel (reuse the parallel query function)
    result = parallel_query_stats(start_date, end_date)
    totals = result["totals"]
    
    # For negative feedback details, we need to query those specifically
    table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
    negative_items = []
    
    # Query negative feedback using GSI
    response = table.query(
        IndexName=FEEDBACK_INDEX,
        KeyConditionExpression=Key("feedback").eq("neg"),
        ScanIndexForward=False,
        ProjectionExpression="conversationId, #ts, question, answer, feedbackTs, #dt",
        ExpressionAttributeNames={"#ts": "timestamp", "#dt": "date"},
        Limit=50,  # Only get recent ones
    )
    
    for item in response.get("Items", []):
        item_date = item.get("date", "")
        if start_date <= item_date <= end_date:
            negative_items.append({
                "conversationId": item.get("conversationId"),
                "timestamp": item.get("timestamp"),
                "question": item.get("question"),
                "answerPreview": item.get("answer", "")[:200],
                "feedbackTs": item.get("feedbackTs"),
            })
    
    negative_items.sort(key=lambda x: x.get("feedbackTs") or x.get("timestamp", ""), reverse=True)
    
    total_feedback = totals["positive"] + totals["negative"]
    satisfaction_rate = 0
    if total_feedback > 0:
        satisfaction_rate = round((totals["positive"] / total_feedback) * 100, 1)
    
    response_data = {
        "summary": {
            "positive": totals["positive"],
            "negative": totals["negative"],
            "noFeedback": totals["no_feedback"],
            "total": totals["count"],
            "satisfactionRate": satisfaction_rate,
        },
        "recentNegative": negative_items[:10],
        "period": {
            "days": days,
            "startDate": start_date,
            "endDate": end_date,
        },
    }
    
    # Cache result
    set_cached_result(cache_key, response_data)
    
    return json_response(200, response_data)


def get_users(event: dict) -> dict:
    """
    Get list of users with pagination.
    Uses Scan operation since we need to list all users.
    
    Query Parameters:
    - limit: Number of records per page (default: 20, max: 100)
    - offset: Number of records to skip (default: 0)
    """
    if not USER_TABLE_NAME:
        return json_response(500, {"error": "USER_TABLE_NAME not configured"})
    
    table = dynamodb.Table(USER_TABLE_NAME)
    
    params = event.get("queryStringParameters") or {}
    limit = min(int(params.get("limit", 20)), 100)  # Cap at 100
    offset = int(params.get("offset", 0))
    
    # We need to scan the entire table to get total count and apply offset
    # For better performance with large datasets, consider adding a GSI
    all_items = []
    
    # Projection to only fetch needed fields
    projection = "userId, createdAt, firstName, lastName, email, phoneNumber, supportQuestion"
    
    try:
        response = table.scan(
            ProjectionExpression=projection,
        )
        all_items.extend(response.get("Items", []))
        
        # Handle pagination for large tables
        while "LastEvaluatedKey" in response:
            response = table.scan(
                ProjectionExpression=projection,
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            all_items.extend(response.get("Items", []))
        
        # Sort by createdAt descending (most recent first)
        all_items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        
        # Apply pagination
        total = len(all_items)
        paginated_items = all_items[offset:offset + limit]
        has_more = (offset + limit) < total
        
        # Format users for response
        users = []
        for item in paginated_items:
            users.append({
                "id": item.get("userId"),
                "firstName": item.get("firstName", ""),
                "lastName": item.get("lastName", ""),
                "email": item.get("email", ""),
                "phoneNumber": item.get("phoneNumber"),
                "supportQuestion": item.get("supportQuestion", ""),
                "createdAt": item.get("createdAt"),
            })
        
        return json_response(200, {
            "users": users,
            "total": total,
            "offset": offset,
            "limit": limit,
            "hasMore": has_more,
        })
        
    except Exception as e:
        print(f"Error fetching users: {e}")
        return json_response(500, {"error": f"Failed to fetch users: {str(e)}"})


def handler(event, context):
    """Main Lambda handler - routes requests to appropriate functions."""
    
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    
    print(f"Admin API: {http_method} {path}")
    
    if http_method == "OPTIONS":
        return json_response(200, {})
    
    # POST endpoints
    if http_method == "POST":
        if "/feedback" in path:
            return submit_feedback(event)
    
    if http_method == "GET":
        if "/admin/stats" in path:
            return get_stats(event)
        elif "/admin/feedback-summary" in path:
            return get_feedback_summary(event)
        elif "/admin/users" in path:
            return get_users(event)
        elif "/admin/conversations/" in path:
            return get_conversation_by_id(event)
        elif "/admin/conversations" in path:
            return get_conversations(event)
    
    return json_response(404, {"error": "Not found"})


def submit_feedback(event: dict) -> dict:
    """
    Submit feedback for a conversation.
    
    Request body:
    {
        "conversationId": "string" (required),
        "feedback": "pos" | "neg" (required)
    }
    """
    try:
        body = event.get("body", "{}")
        if isinstance(body, str):
            payload = json.loads(body)
        else:
            payload = body
        
        conversation_id = payload.get("conversationId")
        feedback_value = payload.get("feedback")
        
        print(f"Processing feedback: {conversation_id} -> {feedback_value}")
        
        if not conversation_id:
            return json_response(400, {"error": "Missing required parameter: conversationId"})
        
        # Accept multiple formats and normalize to pos/neg
        if feedback_value in ["positive", "+", "up"]:
            feedback_value = "pos"
        elif feedback_value in ["negative", "-", "down"]:
            feedback_value = "neg"
        
        if feedback_value not in ["pos", "neg"]:
            return json_response(400, {"error": "Invalid feedback value. Must be 'pos' or 'neg'"})
        
        table = dynamodb.Table(CONVERSATION_HISTORY_TABLE)
        
        # Find the item by conversationId (timestamp is sort key)
        response = table.query(
            KeyConditionExpression=Key("conversationId").eq(conversation_id),
            Limit=1
        )
        
        if not response.get("Items"):
            return json_response(404, {"error": "Conversation not found"})
        
        item = response["Items"][0]
        timestamp = item["timestamp"]
        
        # Update the feedback
        feedback_timestamp = datetime.now(timezone.utc).isoformat()
        
        table.update_item(
            Key={
                "conversationId": conversation_id,
                "timestamp": timestamp
            },
            UpdateExpression="SET feedback = :fb, feedbackTs = :fbt",
            ExpressionAttributeValues={
                ":fb": feedback_value,
                ":fbt": feedback_timestamp
            }
        )
        
        print(f"Updated feedback for conversation {conversation_id}: {feedback_value}")
        
        return json_response(200, {
            "success": True,
            "conversationId": conversation_id,
            "feedback": feedback_value
        })
        
    except Exception as e:
        print(f"Error submitting feedback: {e}")
        return json_response(500, {"error": str(e)})
