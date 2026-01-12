# Cincinnati Museum Chatbot APIs

This document provides comprehensive API documentation for the Cincinnati Museum Chatbot.

---

## Overview

The Cincinnati Museum Chatbot API provides endpoints for:
- **Chat**: Streaming chat interface powered by Amazon Bedrock Knowledge Base
- **Feedback**: User feedback submission for conversation quality tracking
- **Users**: Public user registration and admin user management
- **Admin**: Protected endpoints for dashboard analytics and conversation management
---

## Authentication

### Public Endpoints (No Authentication Required)
| Endpoint | Description |
|----------|-------------|
| `POST /chat` | Chat with the knowledge base |
| `POST /feedback` | Submit feedback for a conversation |
| `POST /users` | Register a new user |

### Protected Endpoints (Cognito Authentication Required)
All `/admin/*` endpoints require a valid Cognito JWT token.

### Headers Required
| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | `application/json` | Yes |
| `Authorization` | Cognito JWT token (for admin endpoints) | Admin only |

---

## 1) Chat Endpoints

Streaming chat interface powered by Amazon Bedrock Knowledge Base with Server-Sent Events (SSE).

> **Note**: This endpoint uses Amazon API Gateway REST API response streaming capability. For more information, see the [AWS announcement](https://aws.amazon.com/about-aws/whats-new/2025/11/api-gateway-response-streaming-rest-apis/).

---

#### POST /chat — Stream chat response from Knowledge Base

- **Purpose**: Send a query to the museum knowledge base and receive a streaming response with citations.

- **Request body**:
```json
{
  "query": "string (required) - The user's question",
  "sessionId": "string (optional) - Session ID for conversation continuity",
  "numberOfResults": "number (optional, default: 5) - Number of knowledge base results to retrieve",
  "language": "string (optional, default: 'en') - Response language ('en' or 'es')"
}
```

- **Example request**:
```json
{
  "query": "What exhibits are currently showing at the museum?",
  "sessionId": "abc123-def456",
  "numberOfResults": 5,
  "language": "en"
}
```

- **Response**: Server-Sent Events (SSE) stream with `Content-Type: text/event-stream`

- **Event Types** (in order):

| Event | Data Schema | Description |
|-------|-------------|-------------|
| `conversationId` | `{ "conversationId": "string" }` | Unique ID for this Q&A pair (for feedback) |
| `sessionId` | `{ "sessionId": "string" }` | Bedrock session ID for conversation continuity |
| `sessionExpired` | `{ "message": "string" }` | Sent if previous session was invalid |
| `text` | `{ "text": "string" }` | Streamed text chunks (multiple events) |
| `citations` | `{ "citations": Citation[] }` | Array of citations (sent once at end) |
| `guardrail` | `{ "action": "string" }` | Guardrail action if triggered |
| `done` | `{ "status": "complete", "conversationId": "string", "responseTimeMs": number }` | Stream completion |
| `error` | `{ "error": "string" }` | Error message if request fails |

- **Citation Schema**:
```json
{
  "retrievedReferences": [
    {
      "content": {
        "text": "string - Extracted text content"
      },
      "location": {
        "type": "S3 | WEB",
        "url": "string - Public HTTPS URL"
      },
      "metadata": {}
    }
  ]
}
```

- **Example SSE stream**:
```
event: conversationId
data: {"conversationId": "550e8400-e29b-41d4-a716-446655440000"}

event: sessionId
data: {"sessionId": "bedrock-session-id"}

event: text
data: {"text": "The museum currently has "}

event: text
data: {"text": "several exciting exhibits..."}

event: citations
data: {"citations": [{"retrievedReferences": [...]}]}

event: done
data: {"status": "complete", "conversationId": "550e8400-e29b-41d4-a716-446655440000", "responseTimeMs": 2340}
```

- **Status codes**:
  - `200 OK` - Stream started successfully
  - `400 Bad Request` - Missing required `query` parameter
  - `500 Internal Server Error` - Bedrock or Lambda error

---

## 2) Feedback Endpoints

Submit user feedback for conversation quality tracking.

---

#### POST /feedback — Submit feedback for a conversation

- **Purpose**: Record positive or negative feedback for a specific conversation.

- **Request body**:
```json
{
  "conversationId": "string (required) - UUID of the conversation",
  "feedback": "string (required) - 'pos' | 'neg' | 'positive' | 'negative'"
}
```

- **Example request**:
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "feedback": "pos"
}
```

- **Response**:
```json
{
  "success": true,
  "conversationId": "string",
  "feedback": "pos | neg"
}
```

- **Status codes**:
  - `200 OK` - Feedback recorded successfully
  - `400 Bad Request` - Missing or invalid parameters
  - `404 Not Found` - Conversation not found
  - `500 Internal Server Error` - Database error

---

## 3) User Endpoints

Public user registration and admin user management.

---

#### POST /users — Create a new user (Public)

- **Purpose**: Register a new user from the chatbot interface.

- **Request body**:
```json
{
  "userId": "string (required) - Unique user identifier",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "phoneNumber": "string (optional)",
  "supportQuestion": "string (optional) - User's support inquiry",
  "createdAt": "string (optional) - ISO timestamp, auto-generated if not provided"
}
```

- **Example request**:
```json
{
  "userId": "user-12345",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "supportQuestion": "I need help with membership"
}
```

- **Response**:
```json
{
  "message": "User created successfully",
  "user": {
    "userId": "string",
    "createdAt": "string (ISO timestamp)",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phoneNumber": "string",
    "supportQuestion": "string"
  }
}
```

- **Status codes**:
  - `201 Created` - User created successfully
  - `400 Bad Request` - Missing userId
  - `500 Internal Server Error` - Database error

---

#### GET /admin/users/{userId} — Get user by ID (Protected)

- **Purpose**: Retrieve user record(s) by userId.

- **Path parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User's unique identifier |

- **Query parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `createdAt` | string | No | ISO timestamp to get specific record |

- **Response** (without createdAt):
```json
{
  "users": [
    {
      "userId": "string",
      "createdAt": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phoneNumber": "string",
      "supportQuestion": "string"
    }
  ],
  "count": 1
}
```

- **Response** (with createdAt):
```json
{
  "user": {
    "userId": "string",
    "createdAt": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string"
  }
}
```

---

#### PUT /admin/users/{userId} — Update user (Protected)

- **Purpose**: Update an existing user record.

- **Path parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User's unique identifier |

- **Request body**:
```json
{
  "createdAt": "string (required) - ISO timestamp of the record to update",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "phoneNumber": "string (optional)",
  "supportQuestion": "string (optional)"
}
```

- **Response**:
```json
{
  "message": "User updated successfully",
  "user": {
    "userId": "string",
    "createdAt": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string"
  }
}
```

- **Status codes**:
  - `200 OK` - User updated successfully
  - `400 Bad Request` - Missing createdAt or no fields to update
  - `404 Not Found` - User record not found
  - `500 Internal Server Error` - Database error

---

#### DELETE /admin/users/{userId} — Delete user (Protected)

- **Purpose**: Delete a user record.

- **Path parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User's unique identifier |

- **Response**:
```json
{
  "success": true,
  "message": "User {userId} deleted successfully"
}
```

- **Status codes**:
  - `200 OK` - User deleted successfully
  - `400 Bad Request` - Missing userId
  - `404 Not Found` - User not found
  - `500 Internal Server Error` - Database error

---

## 4) Admin Endpoints (Protected)

All admin endpoints require Cognito authentication via `Authorization` header.

---

#### GET /admin/stats — Get dashboard statistics

- **Purpose**: Retrieve conversation statistics for the admin dashboard.

- **Query parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | number | No | Number of days to query (default: 7) |
| `startDate` | string | No | Start date (YYYY-MM-DD format) |
| `endDate` | string | No | End date (YYYY-MM-DD format) |

- **Example request**:
```
GET /admin/stats?startDate=2025-01-01&endDate=2025-01-07
```

- **Response**:
```json
{
  "totalConversations": 150,
  "conversationsToday": 23,
  "totalFeedback": 45,
  "positiveFeedback": 38,
  "negativeFeedback": 7,
  "noFeedback": 105,
  "satisfactionRate": 84.4,
  "avgResponseTimeMs": 2340,
  "conversationsByDay": [
    {
      "date": "2025-01-01",
      "count": 20,
      "dayName": "Wed",
      "label": "1"
    }
  ],
  "period": {
    "days": 7,
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  }
}
```

---

#### GET /admin/conversations — Get conversation list

- **Purpose**: Retrieve paginated list of conversations with filtering.

- **Query parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feedback` | string | No | Filter by feedback: `pos`, `neg`, or `none` |
| `startDate` | string | No | Start date (YYYY-MM-DD) |
| `endDate` | string | No | End date (YYYY-MM-DD) |
| `limit` | number | No | Items per page (default: 20) |
| `offset` | number | No | Number of items to skip (default: 0) |

- **Example request**:
```
GET /admin/conversations?feedback=neg&limit=10&offset=0
```

- **Response**:
```json
{
  "conversations": [
    {
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "sessionId": "session-abc123",
      "timestamp": "2025-01-05T10:30:00.000Z",
      "date": "2025-01-05",
      "question": "What are the museum hours?...",
      "answerPreview": "The museum is open Tuesday through Sunday...",
      "feedback": "pos",
      "responseTimeMs": 2340,
      "citationCount": 3,
      "language": "en"
    }
  ],
  "count": 10,
  "total": 150,
  "offset": 0,
  "limit": 10,
  "hasMore": true
}
```

---

#### GET /admin/conversations/{conversationId} — Get conversation details

- **Purpose**: Retrieve full details of a single conversation.

- **Path parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `conversationId` | string | UUID of the conversation |

- **Response**:
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "session-abc123",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "date": "2025-01-05",
  "question": "What are the museum hours?",
  "answer": "The museum is open Tuesday through Sunday from 10am to 5pm...",
  "citations": [
    {
      "retrievedReferences": [
        {
          "content": { "text": "..." },
          "location": { "type": "WEB", "url": "https://..." },
          "metadata": {}
        }
      ]
    }
  ],
  "citationCount": 3,
  "feedback": "pos",
  "feedbackTs": "2025-01-05T10:35:00.000Z",
  "responseTimeMs": 2340,
  "modelId": "global.amazon.nova-2-lite-v1:0",
  "language": "en",
  "questionLength": 28,
  "answerLength": 245
}
```

- **Status codes**:
  - `200 OK` - Success
  - `400 Bad Request` - Missing conversationId
  - `404 Not Found` - Conversation not found

---

#### GET /admin/feedback-summary — Get feedback summary

- **Purpose**: Retrieve feedback statistics and recent negative feedback.

- **Query parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | number | No | Number of days (default: 30) |
| `startDate` | string | No | Start date (YYYY-MM-DD) |
| `endDate` | string | No | End date (YYYY-MM-DD) |

- **Response**:
```json
{
  "summary": {
    "positive": 38,
    "negative": 7,
    "noFeedback": 105,
    "total": 150,
    "satisfactionRate": 84.4
  },
  "recentNegative": [
    {
      "conversationId": "uuid",
      "timestamp": "2025-01-05T10:30:00.000Z",
      "question": "...",
      "answerPreview": "...",
      "feedbackTs": "2025-01-05T10:35:00.000Z"
    }
  ],
  "period": {
    "days": 30,
    "startDate": "2024-12-06",
    "endDate": "2025-01-05"
  }
}
```

---

#### GET /admin/users — List all users

- **Purpose**: Retrieve paginated list of all registered users.

- **Query parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Items per page (default: 20, max: 100) |
| `offset` | number | No | Number of items to skip (default: 0) |

- **Response**:
```json
{
  "users": [
    {
      "id": "user-12345",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phoneNumber": "+1234567890",
      "supportQuestion": "I need help with membership",
      "createdAt": "2025-01-05T10:30:00.000Z"
    }
  ],
  "total": 50,
  "offset": 0,
  "limit": 20,
  "hasMore": true
}
```

---

## Response Format

### Success Response
```json
{
  "statusCode": 200,
  "body": {
    "data": "..."
  }
}
```

### Error Response
```json
{
  "statusCode": 400,
  "body": {
    "error": "Error message description"
  }
}
```

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| `400` | Bad Request | Invalid request parameters or missing required fields |
| `401` | Unauthorized | Missing or invalid Cognito JWT token |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | Requested resource does not exist |
| `405` | Method Not Allowed | HTTP method not supported for endpoint |
| `500` | Internal Server Error | Server-side error (Lambda, DynamoDB, Bedrock) |

---

## Rate Limiting

Rate limiting is managed by API Gateway and AWS service quotas:

- **API Gateway**: Default throttling applies
- **Bedrock Knowledge Base**: Subject to AWS Bedrock quotas
- **DynamoDB**: On-demand capacity mode (auto-scaling)

---

## SDK / Client Examples

### JavaScript/TypeScript (Streaming Chat)
```typescript
const response = await fetch('https://your-api.execute-api.us-east-1.amazonaws.com/prod/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'What exhibits are showing?',
    language: 'en'
  })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

### JavaScript/TypeScript (Admin API with Cognito)
```typescript
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

// Get Cognito token
const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const authResponse = await cognitoClient.send(new InitiateAuthCommand({
  AuthFlow: 'USER_PASSWORD_AUTH',
  ClientId: 'your-client-id',
  AuthParameters: {
    USERNAME: 'admin@example.com',
    PASSWORD: 'your-password'
  }
}));

const idToken = authResponse.AuthenticationResult?.IdToken;

// Call admin API
const response = await fetch('https://your-api.execute-api.us-east-1.amazonaws.com/prod/admin/stats', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': idToken
  }
});

const data = await response.json();
```

### Python
```python
import requests

# Streaming chat
response = requests.post(
    'https://your-api.execute-api.us-east-1.amazonaws.com/prod/chat',
    headers={'Content-Type': 'application/json'},
    json={'query': 'What exhibits are showing?'},
    stream=True
)

for line in response.iter_lines():
    if line:
        decoded = line.decode('utf-8')
        if decoded.startswith('data: '):
            print(decoded[6:])
```

### cURL
```bash
# Chat endpoint
curl -X POST 'https://your-api.execute-api.us-east-1.amazonaws.com/prod/chat' \
  -H 'Content-Type: application/json' \
  -d '{"query": "What are the museum hours?"}'

# Submit feedback
curl -X POST 'https://your-api.execute-api.us-east-1.amazonaws.com/prod/feedback' \
  -H 'Content-Type: application/json' \
  -d '{"conversationId": "uuid-here", "feedback": "pos"}'

# Admin endpoint (with Cognito token)
curl -X GET 'https://your-api.execute-api.us-east-1.amazonaws.com/prod/admin/stats' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: your-cognito-id-token'
```

---

## DynamoDB Table Schemas

### Users Table
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String | Partition Key | Unique user identifier |
| `createdAt` | String | Sort Key | ISO timestamp |
| `firstName` | String | - | User's first name |
| `lastName` | String | - | User's last name |
| `email` | String | - | User's email |
| `phoneNumber` | String | - | User's phone number |
| `supportQuestion` | String | - | Support inquiry text |

### Conversation History Table
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `conversationId` | String | Partition Key | UUID for the Q&A pair |
| `timestamp` | String | Sort Key | ISO timestamp |
| `sessionId` | String | GSI-PK | Session identifier |
| `date` | String | GSI-PK | Date (YYYY-MM-DD) for analytics |
| `feedback` | String | GSI-PK | `pos`, `neg`, or null |
| `question` | String | - | User's question |
| `answer` | String | - | Bot's response |
| `citations` | String | - | JSON array of citations |
| `citationCount` | Number | - | Number of citations |
| `responseTimeMs` | Number | - | Response generation time |
| `modelId` | String | - | Bedrock model used |
| `knowledgeBaseId` | String | - | Knowledge base ID |
| `language` | String | - | Response language |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-05 | Initial API documentation |

---

## Support

For API-related issues or questions:
- Review the [Deployment Guide](./deploymentGuide.md) for setup instructions
- Check the [Architecture Deep Dive](./architectureDeepDive.md) for system design details
- See the [User Guide](./userGuide.md) for frontend usage