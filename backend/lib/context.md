
# backend/lib/context.md

## Bedrock Knowledge Base Model and Embedding Dimension Migration

### Migration History & Region Constraints
- **Initial Model:** Amazon Nova Multimodal Embeddings 1.0 (3072 dims, multimodal)
  - Model ARN: `arn:aws:bedrock:<region>::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`
  - Region: Not available in all regions; only in us-east-1 and select others.
  - Requirements: 3072 embedding dimensions, supplemental S3 bucket for multimodal data, parsingModality="MULTIMODAL".
- **Temporary Model:** Amazon Titan Text Embeddings v2 (1536 dims, text-only)
  - Model ARN: `arn:aws:bedrock:<region>::foundation-model/amazon.titan-embed-text-v2:0`
  - Region: Available in more regions, but only supports text and 1536 dimensions.
  - Requirements: 1536 embedding dimensions, parsingModality="TEXT".

### Reason for Migration
- Deployment failed in regions where Nova was unavailable or unsupported.
- Titan was used for testing, but did not meet multimodal requirements.
- us-east-1 was selected for full Nova support and multimodal capability.

### Current Configuration (as of Feb 2026)
- **Model:** Amazon Nova Multimodal Embeddings 1.0
- **Region:** us-east-1
- **Embedding Dimension:** 3072
- **Parsing Modality:** MULTIMODAL
- **Supplemental Data Storage:** S3 bucket enabled for extracted images

### Implementation Steps
1. Reverted `embeddingModelArn` in backend-stack.ts to Nova 2 ARN for us-east-1.
2. Set `dimensions` to 3072 for Nova.
3. Confirmed parsingModality is "MULTIMODAL" and supplemental S3 bucket is enabled.
4. Documented migration history and region/model constraints.

### Guidance for Future Changes
- Always check model availability in your target region.
- Match embedding dimension to model requirements.
- For multimodal, ensure supplemental S3 bucket and parsingModality="MULTIMODAL".
- If switching regions, update model ARN and specs accordingly.

### Summary
This migration ensures full multimodal support using Nova 2 in us-east-1, with correct embedding dimension and storage configuration. Previous Titan configuration was not suitable for multimodal use cases. Future deployments should verify region/model compatibility before making changes.
