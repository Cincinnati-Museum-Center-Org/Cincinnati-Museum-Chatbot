# backend/lib/context.md

## Bedrock Knowledge Base Model and Embedding Dimension Changes

### Background
This project uses AWS Bedrock Knowledge Base with OpenSearch Serverless for vector storage. The embedding model and its configuration are critical for successful deployment and operation.

### Model Change
- **Previous Model:** Amazon Nova Multimodal Embeddings 1.0
  - Model ARN: `arn:aws:bedrock:<region>::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`
  - Embedding dimension: **3072**
- **Current Model:** Amazon Titan Text Embeddings v2
  - Model ARN: `arn:aws:bedrock:<region>::foundation-model/amazon.titan-embed-text-v2:0`
  - Embedding dimension: **1536**

### Reason for Change
- The Nova model was not supported for the Bedrock Knowledge Base in this region or use case.
- The Titan model is recommended for Knowledge Bases, but it only supports a dimension of 1536 (not 3072).
- Attempting to use 3072 with Titan results in a deployment error: "The specified embedding dimensions is not supported by the model..."

### Action Taken
- Updated the embedding model ARN in `backend-stack.ts` to use Titan v2.
- Changed the embedding dimension from 3072 to 1536 to match Titan v2 requirements.

### Reference
- See the `embeddingModelArn` and `dimensions` fields in `backend/lib/backend-stack.ts` for the current configuration.
- If changing models in the future, always verify the supported embedding dimensions for the selected model in AWS documentation.
