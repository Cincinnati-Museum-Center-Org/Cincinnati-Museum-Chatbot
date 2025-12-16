import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as s3vectors from "aws-cdk-lib/aws-s3vectors";
import * as iam from "aws-cdk-lib/aws-iam";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as os from "os";

export class MuseumChatbot extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const aws_region = cdk.Stack.of(this).region;
    const aws_account = cdk.Stack.of(this).account;
    console.log(`AWS Region: ${aws_region}`);

    const hostArchitecture = os.arch();
    console.log(`Host architecture: ${hostArchitecture}`);

    const timestamp = Date.now();

    const lambdaArchitecture =
      hostArchitecture === "arm64"
        ? lambda.Architecture.ARM_64
        : lambda.Architecture.X86_64;
    console.log(`Lambda architecture: ${lambdaArchitecture}`);

    // ========================================
    // S3 Data Source Bucket
    // ========================================

    // Data source bucket - stores museum documents (PDFs, images, text files)
    const museumDataBucket = new s3.Bucket(this, "MuseumDataBucket", {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Create placeholder files to establish folder structure for museum data
    const prefixes = ['public/', 'private/'];

    prefixes.forEach(prefix => {
      new s3deploy.BucketDeployment(this, `Deploy${prefix.replace('/', '')}`, {
        sources: [s3deploy.Source.data('.placeholder', ' ')],
        destinationBucket: museumDataBucket,
        destinationKeyPrefix: prefix,
      });
    });

    // ========================================
    // Supplemental Data Storage (for multimodal embeddings)
    // ========================================

    // Bucket for storing extracted images from multimodal documents
    // Required when using multimodal embedding models like Nova
    const supplementalDataBucket = new s3.Bucket(this, "SupplementalDataBucket", {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ========================================
    // S3 Vector Bucket and Index
    // ========================================

    // Create the S3 Vector Bucket (specialized for vector storage)
    // Reference: https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_s3vectors.html
    const vectorBucket = new s3vectors.CfnVectorBucket(this, "MuseumVectorBucket", {
      // Let CloudFormation auto-generate the name
      encryptionConfiguration: {
        sseType: "AES256", // Default SSE-S3 encryption
      },
    });

    // Create the Vector Index within the Vector Bucket
    // Amazon Nova Multimodal Embeddings 1.0 produces 3072-dimensional vectors
    const vectorIndex = new s3vectors.CfnIndex(this, "MuseumVectorIndex", {
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
      dataType: "float32",
      dimension: 3072, // Amazon Nova Multimodal Embeddings 1.0 dimension
      distanceMetric: "cosine", // Cosine similarity for semantic search
    });

    // Ensure index is created after the vector bucket
    vectorIndex.addDependency(vectorBucket);

    // ========================================
    // IAM Role for Knowledge Base
    // ========================================

    const knowledgeBaseRole = new iam.Role(this, "KnowledgeBaseRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      description: "IAM role for Museum Knowledge Base",
    });

    // Grant permissions to invoke the embedding model
    knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${aws_region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`,
        ],
      })
    );

    // Grant permissions to access the data source bucket
    museumDataBucket.grantRead(knowledgeBaseRole);

    // Grant permissions to access the supplemental data bucket (for multimodal content)
    supplementalDataBucket.grantReadWrite(knowledgeBaseRole);

    // Grant permissions for S3 Vectors operations
    // Must use specific resource ARNs per AWS documentation:
    // https://docs.aws.amazon.com/bedrock/latest/userguide/kb-permissions.html#kb-permissions-s3vectors
    const s3VectorsPolicy = new iam.PolicyStatement({
      sid: "S3VectorBucketReadAndWritePermission",
      effect: iam.Effect.ALLOW,
      actions: [
        "s3vectors:PutVectors",
        "s3vectors:GetVectors",
        "s3vectors:DeleteVectors",
        "s3vectors:QueryVectors",
        "s3vectors:GetIndex",
      ],
      resources: [
        // Reference the vector index ARN directly
        vectorIndex.attrIndexArn,
      ],
    });
    knowledgeBaseRole.addToPolicy(s3VectorsPolicy);

    // ========================================
    // Knowledge Base with S3 Vectors
    // ========================================

    // Amazon Nova Multimodal Embeddings 1.0 model ARN
    const embeddingModelArn = `arn:aws:bedrock:${aws_region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`;

    // Create the Knowledge Base
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, "MuseumKnowledgeBase", {
      name: "MuseumKnowledgeBase",
      description: "Knowledge base for Museum containing exhibit information, artwork details, and visitor guides",
      roleArn: knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: embeddingModelArn,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: 3072, // Amazon Nova Multimodal Embeddings 1.0 dimension
              embeddingDataType: "FLOAT32",
            },
          },
          // Supplemental data storage for multimodal content (images extracted from documents)
          supplementalDataStorageConfiguration: {
            supplementalDataStorageLocations: [
              {
                supplementalDataStorageLocationType: "S3",
                s3Location: {
                  uri: `s3://${supplementalDataBucket.bucketName}/`,
                },
              },
            ],
          },
        },
      },
      storageConfiguration: {
        type: "S3_VECTORS",
        s3VectorsConfiguration: {
          vectorBucketArn: vectorBucket.attrVectorBucketArn,
          indexArn: vectorIndex.attrIndexArn,
        },
      },
    });

    // Ensure knowledge base is created after vector index and IAM policies are ready
    knowledgeBase.addDependency(vectorIndex);
    
    // Add explicit dependency on the IAM role's default policy to ensure permissions
    // are fully propagated before Knowledge Base creation attempts to validate them
    const defaultPolicyConstruct = knowledgeBaseRole.node.tryFindChild('DefaultPolicy');
    if (defaultPolicyConstruct) {
      const cfnPolicy = defaultPolicyConstruct.node.defaultChild as cdk.CfnResource;
      if (cfnPolicy) {
        knowledgeBase.addDependency(cfnPolicy);
      }
    }

    // ========================================
    // Data Source for Knowledge Base
    // ========================================

    const dataSource = new bedrock.CfnDataSource(this, "MuseumDataSource", {
      name: "MuseumDocuments",
      description: "Museum documents including exhibit guides, artwork information, and visitor resources",
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: museumDataBucket.bucketArn,
        },
      },
      vectorIngestionConfiguration: {
        // Fixed size chunking (default: 300 tokens, 20% overlap)
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: 300,
            overlapPercentage: 20,
          },
        },
      },
    });

    // Ensure data source is created after knowledge base
    dataSource.addDependency(knowledgeBase);

    // ========================================
    // Web Crawler Data Source for Museum Websites
    // ========================================
    // NOTE: Web crawler data sources are currently only supported with 
    // Amazon OpenSearch Serverless vector databases, not S3 Vectors.
    // Uncomment this section when S3 Vectors supports WEB data sources.
    
    // // - Main website: cincymuseum.org
    // // - Collections: searchcollections.cincymuseum.org
    // // - Philanthropy: supportcmc.org
    // const webCrawlerDataSource = new bedrock.CfnDataSource(this, "MuseumWebCrawlerDataSource", {
    //   name: "MuseumWebsites",
    //   description: "Web crawler for Museum websites including main site, collections, and philanthropy",
    //   knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
    //   dataSourceConfiguration: {
    //     type: "WEB",
    //     webConfiguration: {
    //       sourceConfiguration: {
    //         urlConfiguration: {
    //           seedUrls: [
    //             { url: "https://cincymuseum.org" },
    //             { url: "https://searchcollections.cincymuseum.org" },
    //             { url: "https://supportcmc.org" },
    //           ],
    //         },
    //       },
    //       crawlerConfiguration: {
    //         crawlerLimits: {
    //           maxPages: 300, // Limit pages per seed URL to control costs
    //           rateLimit: 20, // Requests per minute to be respectful to servers
    //         },
    //         // scope not specified = Default (same host + same initial URL path)
    //         // Exclude non-content pages
    //         exclusionFilters: [
    //           ".*\\.(jpg|jpeg|png|gif|svg|pdf|zip|exe)$", // Binary files
    //           ".*/login.*",
    //           ".*/admin.*",
    //           ".*/cart.*",
    //           ".*/checkout.*",
    //         ],
    //       },
    //     },
    //   },
    //   vectorIngestionConfiguration: {
    //     chunkingConfiguration: {
    //       chunkingStrategy: "FIXED_SIZE",
    //       fixedSizeChunkingConfiguration: {
    //         maxTokens: 500,
    //         overlapPercentage: 20,
    //       },
    //     },
    //   },
    // });

    // // Ensure web crawler data source is created after knowledge base
    // webCrawlerDataSource.addDependency(knowledgeBase);

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, "MuseumDataBucketName", {
      value: museumDataBucket.bucketName,
      description: "S3 bucket for museum documents (upload your PDFs, images, and text files here)",
    });

    new cdk.CfnOutput(this, "VectorBucketArn", {
      value: vectorBucket.attrVectorBucketArn,
      description: "S3 Vector Bucket ARN for vector embeddings storage",
    });

    new cdk.CfnOutput(this, "VectorIndexArn", {
      value: vectorIndex.attrIndexArn,
      description: "S3 Vector Index ARN",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: knowledgeBase.attrKnowledgeBaseId,
      description: "Bedrock Knowledge Base ID",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseArn", {
      value: knowledgeBase.attrKnowledgeBaseArn,
      description: "Bedrock Knowledge Base ARN",
    });

    new cdk.CfnOutput(this, "DataSourceId", {
      value: dataSource.attrDataSourceId,
      description: "Data Source ID for S3 documents",
    });

    // Uncomment when web crawler data source is enabled
    // new cdk.CfnOutput(this, "WebCrawlerDataSourceId", {
    //   value: webCrawlerDataSource.attrDataSourceId,
    //   description: "Data Source ID for web crawler (Museum websites)",
    // });
  }
}
