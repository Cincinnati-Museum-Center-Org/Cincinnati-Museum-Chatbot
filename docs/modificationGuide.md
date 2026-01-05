# Project Modification Guide

This guide is for developers who want to extend, customize, or modify the Cincinnati Museum Chatbot.

---

## Introduction

This document provides guidance on how to modify and extend the Cincinnati Museum Chatbot. Whether you want to add new features, change existing behavior, or customize the application for your needs, this guide will help you understand the codebase and make changes effectively.

---

## Table of Contents

- [Project Structure Overview](#project-structure-overview)
- [Frontend Modifications](#frontend-modifications)
- [Backend Modifications](#backend-modifications)
- [Knowledge Base Modifications](#knowledge-base-modifications)
- [Changing AI/ML Models](#changing-aiml-models)
- [Database Modifications](#database-modifications)
- [Adding New API Endpoints](#adding-new-api-endpoints)
- [Best Practices](#best-practices)

---

## Project Structure Overview

```
├── backend/
│   ├── bin/backend.ts              # CDK app entry point
│   ├── lib/backend-stack.ts        # Infrastructure definitions (all AWS resources)
│   └── lambda/
│       ├── admin-api/index.py      # Admin dashboard API (stats, conversations, users)
│       ├── invoke-kb/index.py      # Non-streaming KB invocation (legacy)
│       ├── invoke-kb-stream/       # Streaming chat Lambda with FastAPI
│       │   ├── main.py             # FastAPI app with SSE streaming
│       │   ├── requirements.txt    # Python dependencies
│       │   └── run.sh              # Lambda Web Adapter bootstrap
│       ├── user-crud/index.py      # User CRUD operations
│       └── webcrawler/             # Web scraping scripts and data
│           ├── scripts/            # Python scraping utilities
│           └── scraped_data/       # Crawled museum data
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Main chat interface
│   │   ├── admin/page.tsx          # Admin login page
│   │   ├── dashboard/page.tsx      # Admin analytics dashboard
│   │   ├── components/             # Reusable UI components
│   │   │   ├── citations/          # Citation display components
│   │   │   ├── MarkdownContent.tsx # Markdown renderer
│   │   │   ├── SupportModal.tsx    # Support contact form
│   │   │   └── ConfirmModal.tsx    # Confirmation dialogs
│   │   ├── config/
│   │   │   ├── i18n.ts             # Internationalization (EN/ES)
│   │   │   └── dashboardConfig.ts  # Dashboard settings
│   │   ├── context/                # React contexts
│   │   │   ├── LanguageContext.tsx # Language state management
│   │   │   └── AdminAuthContext.tsx# Cognito auth state
│   │   └── globals.css             # Global styles and CSS variables
│   └── public/                     # Static assets (logos, icons)
└── docs/                           # Documentation
```

---

## Frontend Modifications

### Changing the UI Theme

**Location**: `frontend/app/globals.css`

The theme uses CSS custom properties (variables) defined in `:root`. To customize colors:

```css
:root {
  /* Primary brand colors - change these for your organization */
  --primary-blue: #4B7BF5;           /* Main brand color */
  --primary-blue-hover: #3D6AE0;     /* Hover state */
  --primary-blue-light: #EBF0FE;     /* Light accent */
  
  /* Background colors */
  --background: #F5F5F5;             /* Page background */
  --background-white: #FFFFFF;       /* Card backgrounds */
  
  /* Text colors */
  --text-primary: #1A1A1A;           /* Main text */
  --text-secondary: #666666;         /* Secondary text */
  --text-muted: #888888;             /* Muted/placeholder text */
  
  /* Accent colors */
  --accent-gold: #D4A853;            /* Gold accent (optional) */
}
```

### Changing Fonts

**Location**: `frontend/app/layout.tsx` and `frontend/app/globals.css`

The project uses:
- **Montserrat** for headings
- **Open Sans** for body text

To change fonts, update the Google Fonts import in `layout.tsx` and the `font-family` declarations in `globals.css`.

### Adding New Pages

**Location**: `frontend/app/`

Next.js uses file-based routing. To add a new page:

1. Create a new directory: `frontend/app/your-page/`
2. Add a `page.tsx` file:

```tsx
// frontend/app/your-page/page.tsx
export default function YourPage() {
  return (
    <div>
      <h1>Your New Page</h1>
    </div>
  );
}
```

3. For protected pages (admin-only), wrap with auth context:

```tsx
'use client';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function ProtectedPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Access denied</div>;
  
  return <div>Protected content</div>;
}
```

### Modifying the Chat Interface

**Location**: `frontend/app/page.tsx`

Key sections to modify:
- **Quick Actions**: Update the `quickActions` array to change suggestion buttons
- **Welcome Message**: Modify the welcome card JSX
- **Message Styling**: Update the message bubble classes

### Adding New Languages

**Location**: `frontend/app/config/i18n.ts`

1. Add translations to the `translations` object:

```typescript
const translations = {
  en: { /* English strings */ },
  es: { /* Spanish strings */ },
  fr: { /* Add French strings */ },
};
```

2. Update the `Language` type and `LanguageContext` to support the new language.

### Modifying Components

**Location**: `frontend/app/components/`

| Component | Purpose |
|-----------|---------|
| `CitationsDisplay.tsx` | Renders source citations with media previews |
| `MarkdownContent.tsx` | Renders markdown responses |
| `SupportModal.tsx` | Contact support form modal |
| `ConfirmModal.tsx` | Reusable confirmation dialog |
| `FeedbackButtons.tsx` | Thumbs up/down feedback UI |

---

## Backend Modifications

### Lambda Functions Overview

| Lambda | File | Purpose |
|--------|------|---------|
| `InvokeKbStreamLambda` | `lambda/invoke-kb-stream/main.py` | Streaming chat with FastAPI + Lambda Web Adapter |
| `AdminApiLambda` | `lambda/admin-api/index.py` | Dashboard analytics, feedback, user listing |
| `UserCrudLambda` | `lambda/user-crud/index.py` | User registration and CRUD operations |

### Adding New Lambda Functions

**Location**: `backend/lambda/`

1. Create a new directory: `backend/lambda/your-function/`
2. Add your handler file (Python example):

```python
# backend/lambda/your-function/index.py
import json

def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps({'message': 'Success'})
    }
```

3. Add the Lambda to the CDK stack in `backend/lib/backend-stack.ts`:

```typescript
const yourLambda = new lambda.Function(this, "YourLambda", {
  runtime: lambda.Runtime.PYTHON_3_13,
  architecture: lambdaArchitecture,
  handler: "index.handler",
  code: lambda.Code.fromAsset("lambda/your-function"),
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
  environment: {
    // Add environment variables
  },
});
```

### Modifying the CDK Stack

**Location**: `backend/lib/backend-stack.ts`

The stack is organized into sections:

1. **Amplify App** (lines ~50-100): Frontend hosting configuration
2. **S3 Buckets** (lines ~115-175): Data storage
3. **DynamoDB Tables** (lines ~180-275): User and conversation storage
4. **OpenSearch Serverless** (lines ~280-310): Vector database
5. **Knowledge Base** (lines ~350-495): Bedrock KB configuration
6. **Lambda Functions** (lines ~500-650): Chat and admin functions
7. **API Gateway** (lines ~650-850): REST API endpoints
8. **Cognito** (lines ~730-770): Admin authentication

### Adding New API Endpoints

1. **Create or identify the Lambda function** that will handle the endpoint

2. **Add the API Gateway resource and method**:

```typescript
// Create resource
const yourResource = api.root.addResource("your-endpoint");

// Add method with Lambda integration
yourResource.addMethod("POST", new apigateway.LambdaIntegration(yourLambda, {
  proxy: true,
}));

// For protected endpoints, add Cognito authorizer
yourResource.addMethod("GET", new apigateway.LambdaIntegration(yourLambda), {
  authorizer: adminAuthorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

3. **Update the API documentation** in `docs/APIDoc.md`

---

## Knowledge Base Modifications

### Adding New Data Sources

**Location**: `backend/lib/backend-stack.ts` (Web Crawler section ~lines 450-495)

#### Adding Web Crawler URLs

To add new websites to crawl, update the `seedUrls` array:

```typescript
seedUrls: [
  { url: "https://www.cincymuseum.org/#gsc.tab=0" },
  { url: "https://supportcmc.org/" },
  { url: "https://www.cincymuseum.org/event-processing/filename.html" },
  { url: "https://feed.podbean.com/cincinnatimuseumcenter/feed.xml" },
  // Add your new URL here:
  { url: "https://your-new-source.com/" },
],
```

#### Adding S3 Data Sources

Upload documents to the S3 data bucket:

```bash
# Upload to public folder (accessible in citations)
aws s3 cp your-document.pdf s3://your-bucket-name/public/documents/

# Upload to private folder (not exposed in citations)
aws s3 cp your-document.pdf s3://your-bucket-name/private/documents/
```

After uploading, sync the Knowledge Base in the AWS Console or via CLI:

```bash
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id YOUR_KB_ID \
  --data-source-id YOUR_DATA_SOURCE_ID
```

### Modifying Chunking Strategy

**Location**: `backend/lib/backend-stack.ts` (vectorIngestionConfiguration)

```typescript
vectorIngestionConfiguration: {
  chunkingConfiguration: {
    chunkingStrategy: "FIXED_SIZE",
    fixedSizeChunkingConfiguration: {
      maxTokens: 500,        // Adjust chunk size
      overlapPercentage: 20, // Adjust overlap
    },
  },
}
```

Options:
- `FIXED_SIZE`: Fixed token chunks (recommended for general use)
- `HIERARCHICAL`: Parent-child chunks for complex documents
- `SEMANTIC`: AI-based semantic chunking
- `NONE`: No chunking (for pre-chunked data)

---

## Changing AI/ML Models

### Switching the Generation Model

**Location**: `backend/lambda/invoke-kb-stream/main.py`

```python
# Line ~42 - Change the model ID
MODEL_ID = "global.amazon.nova-2-lite-v1:0"  # Current model

# Available options:
# - "global.amazon.nova-2-lite-v1:0"     (Fast, cost-effective)
# - "global.amazon.nova-2-pro-v1:0"      (Better quality)
# - "anthropic.claude-3-sonnet-20240229" (Claude 3 Sonnet)
# - "anthropic.claude-3-haiku-20240307"  (Claude 3 Haiku - fastest)
```

### Switching the Embedding Model

**Location**: `backend/lib/backend-stack.ts` (~line 352)

```typescript
// Current: Amazon Nova Multimodal Embeddings
const embeddingModelArn = `arn:aws:bedrock:${aws_region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`;

// Alternative: Amazon Titan Embeddings
// const embeddingModelArn = `arn:aws:bedrock:${aws_region}::foundation-model/amazon.titan-embed-text-v2:0`;
```

> **Warning**: Changing the embedding model requires re-indexing all data in the Knowledge Base.

### Modifying the System Prompt

**Location**: `backend/lambda/invoke-kb-stream/main.py` (~lines 166-177)

The prompt template is configured for Spanish language support. To modify:

```python
kb_config["generationConfiguration"] = {
    "promptTemplate": {
        "textPromptTemplate": """Your custom system prompt here.

$search_results$

$output_format_instructions$"""
    }
}
```

> **Important**: Always include `$search_results$` and `$output_format_instructions$` placeholders.

### Adjusting Retrieval Settings

**Location**: `backend/lambda/invoke-kb-stream/main.py` (~lines 145-160)

```python
kb_config = {
    "knowledgeBaseId": KNOWLEDGE_BASE_ID,
    "modelArn": MODEL_ID,
    "retrievalConfiguration": {
        "vectorSearchConfiguration": {
            "numberOfResults": 5,  # Increase for more context
            "overrideSearchType": "HYBRID"  # Options: HYBRID, SEMANTIC
        }
    },
    "orchestrationConfiguration": {
        "queryTransformationConfiguration": {
            "type": "QUERY_DECOMPOSITION"  # Breaks complex queries
        }
    }
}
```

---

## Database Modifications

### DynamoDB Tables

The project uses two DynamoDB tables:

#### Users Table (`MuseumChatbot-Users`)

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String | Partition Key | Unique user identifier |
| `createdAt` | String | Sort Key | ISO timestamp |
| `firstName` | String | - | User's first name |
| `lastName` | String | - | User's last name |
| `email` | String | - | User's email |
| `phoneNumber` | String | - | User's phone number |
| `supportQuestion` | String | - | Support inquiry text |

#### Conversation History Table (`MuseumChatbot-ConversationHistory`)

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `conversationId` | String | Partition Key | UUID for the Q&A pair |
| `timestamp` | String | Sort Key | ISO timestamp |
| `sessionId` | String | GSI | Session identifier |
| `date` | String | GSI | Date (YYYY-MM-DD) |
| `feedback` | String | GSI | `pos`, `neg`, or null |
| `question` | String | - | User's question |
| `answer` | String | - | Bot's response |
| `citations` | String | - | JSON array of citations |

### Adding New DynamoDB Tables

**Location**: `backend/lib/backend-stack.ts`

```typescript
const yourTable = new dynamodb.Table(this, "YourTable", {
  tableName: `MuseumChatbot-YourTable`,
  partitionKey: {
    name: "id",
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: "createdAt",
    type: dynamodb.AttributeType.STRING,
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  pointInTimeRecoverySpecification: {
    pointInTimeRecoveryEnabled: true,
  },
});

// Add GSI if needed
yourTable.addGlobalSecondaryIndex({
  indexName: "your-index",
  partitionKey: {
    name: "yourField",
    type: dynamodb.AttributeType.STRING,
  },
  projectionType: dynamodb.ProjectionType.ALL,
});

// Grant Lambda access
yourTable.grantReadWriteData(yourLambda);
```

### Adding Attributes to Existing Tables

DynamoDB is schemaless, so you can add new attributes without modifying the table:

1. Update the Lambda function to write the new attribute
2. Update queries to include the new attribute in projections
3. Add GSI if you need to query by the new attribute

---

## Best Practices

### General Guidelines

1. **Test locally before deploying** - Use `cdk synth` to validate CDK changes
2. **Use environment variables** - Don't hardcode sensitive values or API endpoints
3. **Follow existing patterns** - Maintain consistency with the codebase
4. **Update documentation** - Keep docs in sync with code changes
5. **Version control** - Make small, focused commits

### Security Best Practices

1. **Never commit secrets** - Use AWS Secrets Manager or environment variables
2. **Use least privilege IAM** - Only grant permissions that are needed
3. **Validate inputs** - Sanitize user input in Lambda functions
4. **Keep dependencies updated** - Regularly update npm and pip packages

### Performance Tips

1. **Use pagination** - For large data sets, use `limit` and `offset`
2. **Cache when possible** - The admin API uses in-memory caching (60s TTL)
3. **Use projections** - Only fetch needed attributes from DynamoDB
4. **Parallel queries** - Use ThreadPoolExecutor for concurrent date queries

---

## Testing Your Changes

### Local Frontend Testing

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Local Backend Testing (CDK)

```bash
cd backend
npm install
cdk synth          # Validate CloudFormation template
cdk diff           # See what will change
```

### Deployment Testing

```bash
# Full deployment
./deploy.sh

# Or manual CDK deployment
cd backend
cdk deploy -c githubToken=xxx -c githubOwner=xxx -c githubRepo=xxx

# Fast Lambda-only updates (no infrastructure changes)
cdk deploy --hotswap
```

### Testing Lambda Functions Locally

You can test Lambda functions using AWS SAM or by invoking directly:

```bash
# Using AWS CLI
aws lambda invoke \
  --function-name YourFunctionName \
  --payload '{"body": "{\"query\": \"test\"}"}' \
  response.json
```

---

## Common Modifications

### Changing the Logo

1. Replace `frontend/public/CMC_LOGO.svg` with your logo
2. Update references in `frontend/app/page.tsx` and `frontend/app/layout.tsx`

### Changing Quick Action Buttons

**Location**: `frontend/app/page.tsx` (~lines 243-250)

```typescript
const quickActions = [
  { key: 'planYourVisit', icon: <MapPin size={20} />, primary: true },
  { key: 'currentExhibits', icon: <Clock size={20} />, primary: true },
  // Add or modify actions here
];
```

Also update translations in `frontend/app/config/i18n.ts`.

### Adding Admin Users

Admin users are managed through Cognito. To add a new admin:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password TempPassword123!
```

### Modifying CORS Settings

**Location**: `backend/lib/backend-stack.ts` (~lines 680-685)

```typescript
defaultCorsPreflightOptions: {
  allowOrigins: apigateway.Cors.ALL_ORIGINS,  // Or specify domains
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
},
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Check API Gateway CORS config and Lambda response headers |
| 401 Unauthorized | Verify Cognito token is valid and not expired |
| Streaming not working | Ensure API Gateway has `responseTransferMode: STREAM` |
| Knowledge Base returns empty | Sync the data source after adding new content |
| Lambda timeout | Increase `timeout` in CDK stack |

### Useful Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/YourFunctionName --follow

# Check Knowledge Base status
aws bedrock-agent get-knowledge-base --knowledge-base-id YOUR_KB_ID

# List data source sync jobs
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id YOUR_KB_ID \
  --data-source-id YOUR_DS_ID
```

---

## Conclusion

This project is designed to be extensible. We encourage developers to modify and improve the system to better serve their needs. If you create useful extensions, consider contributing back to the project.

For questions or support:
- Review the [API Documentation](./APIDoc.md)
- Check the [Deployment Guide](./deploymentGuide.md)
- See the [User Guide](./userGuide.md)
