# Architecture Deep Dive

This document provides a detailed explanation of the Cincinnati Museum Chatbot architecture.

---

## Architecture Diagram

![Architecture Diagram](./media/architecture.png)

---

## Architecture Overview

The Cincinnati Museum Chatbot is built on a fully serverless AWS architecture, designed for scalability, cost-efficiency, and ease of maintenance. The system consists of three main user flows:

1. **Visitor Chat Flow** - Museum guests interact with the AI chatbot
2. **Admin Dashboard Flow** - Staff access analytics and conversation history
3. **Knowledge Ingestion Flow** - Content is indexed from S3 and web sources

---

## Architecture Flow

### 1. User Interaction (Museum Guests, Donors, Staff)

Users access the chatbot through a modern web interface hosted on **AWS Amplify**:

- The **Frontend** is a Next.js application with Server-Side Rendering (SSR)
- Supports both English and Spanish languages
- Provides quick action buttons for common queries
- Displays streaming responses with source citations

### 2. API Gateway (HTTP API)

All requests from the frontend are routed through **Amazon API Gateway**:

- REST API with CORS support for cross-origin requests
- Routes requests to appropriate Lambda functions
- Supports response streaming for real-time chat
- Public endpoints for chat and feedback
- Protected endpoints (Cognito auth) for admin APIs

### 3. Invoke KB Stream Lambda

The core chat functionality is handled by the **Invoke KB Stream Lambda**:

- Built with FastAPI and Lambda Web Adapter for HTTP streaming
- Receives user queries and forwards them to Bedrock Knowledge Base
- Streams responses back to the frontend using Server-Sent Events (SSE)
- Saves conversation history to DynamoDB for analytics
- Handles session management for multi-turn conversations

### 4. Bedrock Knowledge Base

**Amazon Bedrock Knowledge Base** provides the RAG (Retrieval-Augmented Generation) capabilities:

- Uses **Amazon Nova Multimodal Embeddings** for vector embeddings
- Uses **Amazon Nova Lite** for text generation
- Performs hybrid search (semantic + keyword) for better accuracy
- Supports query decomposition for complex questions
- Returns citations with source references

### 5. OpenSearch Serverless

**Amazon OpenSearch Serverless** serves as the vector database:

- Stores document embeddings in a vector collection
- Enables fast similarity search for relevant content
- Automatically scales based on query volume
- Configured with 3072-dimension vectors for Nova embeddings

### 6. Data Sources

The Knowledge Base is populated from multiple sources:

#### Museum Resources (S3 Bucket)
- PDFs, images, and text documents uploaded by staff
- Public folder for content that can be cited with URLs
- Private folder for internal documents

#### Multi Modal Storage (S3 Bucket)
- Stores extracted images from multimodal documents
- Used by Bedrock Data Automation for document parsing

#### Web Crawler
- Crawls official museum websites:
  - `cincymuseum.org` - Main museum website
  - `supportcmc.org` - Philanthropy site
  - Event processing pages
  - Podcast feed (Meanwhile... at the Museum)
- Automatically indexes new content

### 7. Admin Flow

Administrators access the dashboard through a separate authentication flow:

1. **Amazon Cognito** authenticates admin users
2. Protected API endpoints verify JWT tokens
3. **Admin API Lambda** handles dashboard requests
4. Returns statistics, conversation history, and user data

### 8. Data Storage (DynamoDB)

Two DynamoDB tables store application data:

#### User Info Collection
- Stores visitor support requests
- Captures contact information for follow-up
- Managed by User CRUD Lambda

#### Conversation Logs
- Records all Q&A interactions
- Stores feedback (positive/negative)
- Enables analytics and reporting
- GSIs for efficient querying by date, session, and feedback

---

## Cloud Services / Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
  - Static site generation for optimal performance
  - Client-side streaming for chat responses
  - Tailwind CSS for styling
  - Lucide icons for UI elements

- **AWS Amplify**: Frontend hosting and CI/CD
  - Automatic builds on git push
  - Environment variables injected at build time
  - Custom domain support

### Backend Infrastructure

- **AWS CDK**: Infrastructure as Code
  - TypeScript-based stack definitions
  - Reproducible deployments
  - Automatic dependency management

- **Amazon API Gateway**: REST API
  - Response streaming support
  - CORS configuration
  - Cognito authorizer integration

- **AWS Lambda**: Serverless compute
  - **InvokeKbStreamLambda**: FastAPI with streaming (Python 3.13)
  - **AdminApiLambda**: Dashboard analytics (Python 3.13)
  - **UserCrudLambda**: User management (Python 3.13)

### AI/ML Services

- **Amazon Bedrock**: Foundation model service
  - Knowledge Base with RAG capabilities
  - Nova Lite for text generation
  - Nova Multimodal Embeddings for vectors
  - Bedrock Data Automation for document parsing

- **Amazon OpenSearch Serverless**: Vector database
  - Serverless vector collection
  - Automatic scaling and management
  - L2 distance metric for similarity search

### Data Storage

- **Amazon S3**: Object storage
  - Museum data bucket (documents, images)
  - Supplemental data bucket (extracted content)
  - Public access for citation URLs

- **Amazon DynamoDB**: NoSQL database
  - Users table (support requests)
  - Conversation history table (analytics)
  - On-demand capacity mode
  - Point-in-time recovery enabled

### Security & Authentication

- **Amazon Cognito**: User authentication
  - Admin user pool for dashboard access
  - Email-based sign-in
  - Password policies enforced

- **AWS Secrets Manager**: Secure storage
  - GitHub token for Amplify builds

---

## Infrastructure as Code

This project uses **AWS CDK (Cloud Development Kit)** to define and deploy infrastructure.

### CDK Stack Structure

```
backend/
├── bin/
│   └── backend.ts              # CDK app entry point
├── lib/
│   └── backend-stack.ts        # Main stack definition (~1000 lines)
└── lambda/
    ├── admin-api/index.py      # Admin dashboard API
    ├── invoke-kb-stream/       # Streaming chat Lambda
    │   ├── main.py             # FastAPI application
    │   ├── requirements.txt    # Python dependencies
    │   └── run.sh              # Lambda Web Adapter bootstrap
    ├── user-crud/index.py      # User management
    └── webcrawler/             # Data scraping utilities
```

### Key CDK Constructs

1. **VectorCollection** (cdklabs/generative-ai-cdk-constructs)
   - Creates OpenSearch Serverless collection
   - Configures encryption and network policies

2. **CfnKnowledgeBase** (aws-cdk-lib/aws-bedrock)
   - Defines Bedrock Knowledge Base
   - Configures embedding model and vector store

3. **CfnDataSource** (aws-cdk-lib/aws-bedrock)
   - S3 data source for documents
   - Web crawler data source for websites

4. **Function** (aws-cdk-lib/aws-lambda)
   - Lambda functions with Python runtime
   - Lambda Web Adapter layer for streaming

5. **RestApi** (aws-cdk-lib/aws-apigateway)
   - API Gateway with streaming support
   - Cognito authorizer for protected routes

### Deployment Automation

- **AWS CodeBuild**: CI/CD pipeline
  - Triggered by deploy.sh script
  - Builds and deploys CDK stack
  - ARM64 architecture for cost efficiency

- **AWS Amplify**: Frontend CI/CD
  - Automatic builds on git push
  - Environment variables from CDK outputs
  - Custom build specification

---

## Security Considerations

### Authentication
- **Admin Dashboard**: Cognito User Pool with email verification
- **Public APIs**: No authentication required (chat, feedback, user registration)
- **Protected APIs**: Cognito JWT token validation

### Authorization
- **IAM Roles**: Least privilege principle for Lambda functions
- **API Gateway**: Cognito authorizer for admin endpoints
- **S3**: Public read access only for `public/` prefix

### Data Encryption
- **At Rest**: S3 server-side encryption, DynamoDB encryption
- **In Transit**: HTTPS for all API calls, TLS for internal AWS traffic

### Network Security
- **API Gateway**: CORS configured for Amplify domain
- **OpenSearch Serverless**: VPC-free with IAM authentication
- **S3**: Block public access except for public prefix

### Data Privacy
- **Conversation Logs**: Stored for analytics, no PII in queries
- **User Data**: Collected only through support form (opt-in)
- **Citations**: Only public S3 content exposed in responses

---

## Scalability

### Auto-scaling
- **Lambda**: Automatic scaling to 1000+ concurrent executions
- **DynamoDB**: On-demand capacity mode (auto-scaling)
- **OpenSearch Serverless**: Automatic compute scaling
- **API Gateway**: Managed service with automatic scaling

### Performance Optimizations
- **Response Streaming**: Real-time text delivery via SSE
- **Parallel Queries**: ThreadPoolExecutor for date-based analytics
- **In-Memory Caching**: 60-second TTL for dashboard stats
- **Projection Expressions**: Minimal data fetch from DynamoDB

### Cost Optimization
- **Serverless Architecture**: Pay only for actual usage
- **On-Demand DynamoDB**: No provisioned capacity costs
- **OpenSearch Serverless**: No cluster management overhead
- **Lambda ARM64**: Lower cost than x86 architecture

---

## Data Flow Diagrams

### Chat Request Flow

```
User → Amplify → API Gateway → InvokeKbStreamLambda
                                      ↓
                              Bedrock Knowledge Base
                                      ↓
                              OpenSearch Serverless
                                      ↓
                              (retrieve documents)
                                      ↓
                              Nova Lite (generate)
                                      ↓
                              Stream Response → User
                                      ↓
                              Save to DynamoDB
```

### Admin Dashboard Flow

```
Admin → Cognito (auth) → Amplify → API Gateway
                                        ↓
                                  AdminApiLambda
                                        ↓
                                  DynamoDB (query)
                                        ↓
                                  Return Stats → Admin
```

### Knowledge Ingestion Flow

```
S3 Upload / Web Crawler
         ↓
  Bedrock Data Source
         ↓
  Document Parsing (BDA)
         ↓
  Nova Embeddings
         ↓
  OpenSearch Serverless
```

---

## Related Documentation

- [Deployment Guide](./deploymentGuide.md) - How to deploy the application
- [API Documentation](./APIDoc.md) - Complete API reference
- [Modification Guide](./modificationGuide.md) - How to customize the application
- [User Guide](./userGuide.md) - How to use the chatbot

