import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as os from "os";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as amplify from "@aws-cdk/aws-amplify-alpha";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, } from "aws-cdk-lib/custom-resources";
import { opensearchserverless, opensearch_vectorindex, bedrock as bedrockL2, } from "@cdklabs/generative-ai-cdk-constructs";

export class MuseumChatbot extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const aws_region = cdk.Stack.of(this).region;
    const aws_account = cdk.Stack.of(this).account;
    console.log(`AWS Region: ${aws_region}`);

    const githubToken = this.node.tryGetContext("githubToken");
    const githubOwner = this.node.tryGetContext("githubOwner");
    const githubRepo = this.node.tryGetContext("githubRepo");

    if (!githubToken || !githubOwner || !githubRepo)
      throw new Error(
        "Missing required context variable(s): githubToken, githubOwner, and/or githubRepo. Please provide all in CDK context (e.g., cdk deploy -c githubToken=your_github_token -c githubOwner=your_github_owner -c githubRepo=your_github_repo)"
      );

    const hostArchitecture = os.arch();
    console.log(`Host architecture: ${hostArchitecture}`);

    const lambdaArchitecture =
      hostArchitecture === "arm64"
        ? lambda.Architecture.ARM_64
        : lambda.Architecture.X86_64;
    console.log(`Lambda architecture: ${lambdaArchitecture}`);

    const githubToken_secret_manager = new secretsmanager.Secret(this,"GitHubToken", {
        secretName: "github-secret-token",
        description: "GitHub Personal Access Token for Amplify",
        secretStringValue: cdk.SecretValue.unsafePlainText(githubToken),
      });


    const amplifyApp = new amplify.App(this, "AmplifyFrontendUI", {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: githubOwner,
        repository: githubRepo,
        oauthToken: githubToken_secret_manager.secretValue,
      }),
      buildSpec: cdk.aws_codebuild.BuildSpec.fromObjectToYaml({
        version: 1,
        frontend: {
          phases: {
            preBuild: {
              commands: ["cd frontend", "npm ci"],
            },
            build: {
              commands: ["npm run build"],
            },
          },
          artifacts: {
            baseDirectory: "frontend/out",
            files: ["**/*"],
          },
          cache: {
            paths: ["frontend/node_modules/**/*"],
          },
        },
      }),
      customRules: [
        // Specific routes - must come BEFORE the catch-all rule
        // Next.js static export generates /admin.html and /dashboard.html
        {
          source: "/admin",
          target: "/admin.html",
          status: amplify.RedirectStatus.REWRITE,
        },
        {
          source: "/dashboard",
          target: "/dashboard.html",
          status: amplify.RedirectStatus.REWRITE,
        },
        // Catch-all for SPA behavior - routes without file extensions go to index.html
        // This handles any other client-side routes
        {
          source: "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|html)$)([^.]+$)/>",
          target: "/index.html",
          status: amplify.RedirectStatus.REWRITE,
        },
      ],
    });

    const mainBranch = amplifyApp.addBranch("master", {
      autoBuild: true,
      stage: "PRODUCTION",
    });

    const featureBranch = amplifyApp.addBranch("feature/user-crud-api", {
      autoBuild: true,
      stage: "DEVELOPMENT",
    });

    // Create Amplify app URL constant for CORS
    const amplifyAppUrl = amplifyApp.appId
      ? `https://master.${amplifyApp.appId}.amplifyapp.com`
      : "*";

    githubToken_secret_manager.grantRead(amplifyApp);

    // ========================================
    // S3 Data Source Bucket
    // ========================================

    // Data source bucket - stores museum documents (PDFs, images, text files)
    // Public access is enabled for the public/ prefix only via bucket policy below
    const museumDataBucket = new s3.Bucket(this, "MuseumDataBucket", {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
      // Allow public access to be configured via bucket policy for public/ prefix
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,  // Allow bucket policy to grant public access
        restrictPublicBuckets: false,  // Allow public access via bucket policy
      }),
      // CORS configuration for frontend access to images
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],  // Allow all origins for public images
          exposedHeaders: [],
        },
      ],
    });

    // Add bucket policy to allow public read access ONLY to the public/ prefix
    museumDataBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ["s3:GetObject"],
      resources: [`${museumDataBucket.bucketArn}/public/*`],
    }));

    // Create placeholder files to establish folder structure for museum data
    const prefixes = ['public/', 'private/'];

    prefixes.forEach(prefix => {
      new s3deploy.BucketDeployment(this, `Deploy${prefix.replace('/', '')}`, {
        sources: [s3deploy.Source.data('.placeholder', ' ')],
        destinationBucket: museumDataBucket,
        destinationKeyPrefix: prefix,
      });
    });

    // CMC photographs are uploaded separately via AWS CLI to avoid redeployment on every cdk deploy:
    // aws s3 sync ./lambda/webcrawler/scraped_data/bedrock_kb_ready/images s3://<bucket-name>/public/cmc-photographs/

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
    // DynamoDB Table: User Information
    // ========================================

    // Table to collect and store user information from chatbot interactions
    const userTable = new dynamodb.Table(this, "UserTable", {
      tableName: `MuseumChatbot-Users`,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "createdAt",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing for cost efficiency
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain user data on stack deletion
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true, // Enable point-in-time recovery for data protection
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // Server-side encryption
    });

    // ========================================
    // DynamoDB Table: Conversation History
    // ========================================

    // Table to store conversation history for analytics and admin dashboard
    // Schema:
    // - conversationId (PK): Unique ID for each Q&A pair
    // - sessionId (SK): Session ID for grouping conversations
    // - timestamp: ISO timestamp of the conversation
    // - question: User's question
    // - answer: Bot's response
    // - citations: JSON array of citations returned
    // - feedback: 'positive' | 'negative' | null
    // - feedbackTimestamp: When feedback was submitted
    // - responseTimeMs: Time taken to generate response
    // - modelId: Model used for generation
    // - knowledgeBaseId: KB used
    // - language: User's language preference
    const conversationHistoryTable = new dynamodb.Table(this, "ConversationHistoryTable", {
      tableName: `MuseumChatbot-ConversationHistory`,
      partitionKey: {
        name: "conversationId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI for querying by sessionId (to get all conversations in a session)
    conversationHistoryTable.addGlobalSecondaryIndex({
      indexName: "sessionId-timestamp-index",
      partitionKey: {
        name: "sessionId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by date (for admin dashboard analytics)
    conversationHistoryTable.addGlobalSecondaryIndex({
      indexName: "date-timestamp-index",
      partitionKey: {
        name: "date",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by feedback status (for reviewing positive/negative responses)
    conversationHistoryTable.addGlobalSecondaryIndex({
      indexName: "feedback-timestamp-index",
      partitionKey: {
        name: "feedback",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // OpenSearch Serverless Vector Collection (L2 Construct)
    // ========================================

    // Create OpenSearch Serverless Vector Collection using cdklabs L2 construct
    // This automatically creates encryption, network, and data access policies
    // Collection name will be auto-generated by CloudFormation
    const vectorCollection = new opensearchserverless.VectorCollection(this, "MuseumVectorCollection", {
      description: "Vector collection for Museum Knowledge Base",
      standbyReplicas: opensearchserverless.VectorCollectionStandbyReplicas.DISABLED, // Cost optimization for dev
    });

    // Create Vector Index within the OpenSearch Serverless collection
    const vectorIndex = new opensearch_vectorindex.VectorIndex(this, "MuseumVectorIndex", {
      collection: vectorCollection,
      indexName: cdk.Names.uniqueResourceName(this, { maxLength: 63, separator: "-" }).toLowerCase(),
      vectorDimensions: 3072, // Amazon Nova Multimodal Embeddings 1.0 dimension
      vectorField: "bedrock-knowledge-base-default-vector",
      precision: "float",
      distanceType: "l2",
      mappings: [
        {
          mappingField: "AMAZON_BEDROCK_TEXT_CHUNK",
          dataType: "text",
          filterable: true,
        },
        {
          mappingField: "AMAZON_BEDROCK_METADATA",
          dataType: "text",
          filterable: false,
        },
      ],
    });

    // ========================================
    // IAM Role for Knowledge Base
    // ========================================

    const knowledgeBaseRole = new iam.Role(this, "KnowledgeBaseRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      description: "IAM role for Museum Knowledge Base",
    });

    // Grant full Bedrock access for Knowledge Base operations
    knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:*"],
        resources: ["*"],
      })
    );

    // Grant permissions to access the data source bucket
    museumDataBucket.grantRead(knowledgeBaseRole);

    // Grant permissions to access the supplemental data bucket (for multimodal content)
    supplementalDataBucket.grantReadWrite(knowledgeBaseRole);

    // Grant data access to the OpenSearch Serverless collection
    vectorCollection.grantDataAccess(knowledgeBaseRole);

    // Add OpenSearch Serverless API permissions for Knowledge Base
    knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["aoss:APIAccessAll"],
        resources: [vectorCollection.collectionArn],
      })
    );

    // ========================================
    // Knowledge Base with OpenSearch Serverless
    // ========================================

    // Amazon Nova Multimodal Embeddings 1.0 model ARN
    const embeddingModelArn = `arn:aws:bedrock:${aws_region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`;

    // Create the Knowledge Base with OpenSearch Serverless vector store
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, "MuseumKnowledgeBase", {
      name: `MuseumKnowledgeBase-${cdk.Names.uniqueId(this).slice(-8)}`,
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
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: vectorCollection.collectionArn,
          vectorIndexName: vectorIndex.indexName,
          fieldMapping: {
            vectorField: vectorIndex.vectorField,
            textField: "AMAZON_BEDROCK_TEXT_CHUNK",
            metadataField: "AMAZON_BEDROCK_METADATA",
          },
        },
      },
    });

    // Ensure knowledge base is created after vector index and IAM policies are ready
    knowledgeBase.node.addDependency(vectorIndex);
    
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
    // Data Source for Knowledge Base (S3)
    // ========================================

    const dataSource = new bedrock.CfnDataSource(this, "MuseumDataSource", {
      name: "MuseumDocuments-v2",
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
        // Use Bedrock Data Automation (BDA) for advanced document parsing
        parsingConfiguration: {
          parsingStrategy: "BEDROCK_DATA_AUTOMATION",
          bedrockDataAutomationConfiguration: {
            parsingModality: "MULTIMODAL",
          },
        },
      },
    });

    // Ensure data source is created after knowledge base
    dataSource.addDependency(knowledgeBase);

    // ========================================
    // Web Crawler Data Source for Museum Websites
    // ========================================
    // - Main website: cincymuseum.org
    // - Collections: searchcollections.cincymuseum.org
    // - Philanthropy: supportcmc.org
    const webCrawlerDataSource = new bedrock.CfnDataSource(this, "MuseumWebCrawlerDataSource", {
      name: "MuseumWebsites-v2",
      description: "Web crawler for Museum websites including main site, collections, and philanthropy",
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: "WEB",
        webConfiguration: {
          sourceConfiguration: {
            urlConfiguration: {
              seedUrls: [
                { url: "https://www.cincymuseum.org/#gsc.tab=0" },
                // { url: "https://searchcollections.cincymuseum.org" },
                { url: "https://supportcmc.org/" },
              ],
            },
          },
          crawlerConfiguration: {
            crawlerLimits: {
              maxPages: 1500, // Limit pages per seed URL to control costs
              rateLimit: 50, // Requests per minute to be respectful to servers
            },

          },
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: 500,
            overlapPercentage: 20,
          },
        },
        // Use Bedrock Data Automation (BDA) for advanced document parsing
        parsingConfiguration: {
          parsingStrategy: "BEDROCK_DATA_AUTOMATION",
          bedrockDataAutomationConfiguration: {
            parsingModality: "MULTIMODAL",
          },
        },
      },
    });

    // Ensure web crawler data source is created after knowledge base
    webCrawlerDataSource.addDependency(knowledgeBase);

    // ========================================
    // Lambda Function: Invoke Knowledge Base
    // ========================================

    // Create IAM role for the Lambda function
    const invokeKbLambdaRole = new iam.Role(this, "InvokeKbLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "IAM role for Knowledge Base invocation Lambda",
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          "LambdaBasicExecution",
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Grant permissions to invoke Bedrock Knowledge Base
    invokeKbLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:RetrieveAndGenerate",
          "bedrock:Retrieve",
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetInferenceProfile",
        ],
        resources: ["*"],
      })
    );

    // Lambda function to invoke Knowledge Base with Retrieve and Generate API
    const invokeKbLambda = new lambda.Function(this, "InvokeKbLambda", {
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambdaArchitecture,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/invoke-kb"),
      role: invokeKbLambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
      },
      description: "Invokes Bedrock Knowledge Base with Retrieve and Generate API for multimodal responses",
    });

    // Ensure Lambda is created after Knowledge Base
    invokeKbLambda.node.addDependency(knowledgeBase);

    // ========================================
    // Streaming Lambda Function with Lambda Web Adapter
    // ========================================
    // Uses Lambda Web Adapter Layer for Python response streaming
    // Reference: https://github.com/aws-samples/serverless-samples/tree/main/apigw-response-streaming/python-strands-lambda

    // Lambda Web Adapter Layer ARN (managed by AWS)
    // See: https://github.com/awslabs/aws-lambda-web-adapter
    const lambdaWebAdapterLayerArn = lambdaArchitecture === lambda.Architecture.ARM_64
      ? `arn:aws:lambda:${aws_region}:753240598075:layer:LambdaAdapterLayerArm64:25`
      : `arn:aws:lambda:${aws_region}:753240598075:layer:LambdaAdapterLayerX86:25`;

    // Streaming Lambda function with FastAPI and Lambda Web Adapter
    const invokeKbStreamLambda = new lambda.Function(this, "InvokeKbStreamLambda", {
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambdaArchitecture,
      handler: "run.sh",
      code: lambda.Code.fromAsset("lambda/invoke-kb-stream", {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            "bash", "-c",
            "pip install -r requirements.txt -t /asset-output && cp -au . /asset-output"
          ],
        },
      }),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_INVOKE_MODE: "response_stream",
        PORT: "8000",
        CONVERSATION_HISTORY_TABLE: conversationHistoryTable.tableName,
      },
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, "LambdaWebAdapterLayer", lambdaWebAdapterLayerArn),
      ],
      description: "Streaming Lambda with FastAPI for Bedrock KB (uses Lambda Web Adapter)",
    });

    // Grant permissions to invoke Bedrock Knowledge Base
    invokeKbStreamLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:RetrieveAndGenerate",
          "bedrock:Retrieve",
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetInferenceProfile",
        ],
        resources: ["*"],
      })
    );

    // Grant DynamoDB permissions for conversation history
    conversationHistoryTable.grantReadWriteData(invokeKbStreamLambda);

    // Ensure Lambda is created after Knowledge Base
    invokeKbStreamLambda.node.addDependency(knowledgeBase);

    // ========================================
    // Lambda Function: User CRUD Operations
    // ========================================

    // Create IAM role for the User CRUD Lambda function
    const userCrudLambdaRole = new iam.Role(this, "UserCrudLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "IAM role for User CRUD Lambda",
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          "UserCrudLambdaBasicExecution",
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Grant permissions to access DynamoDB User Table
    userTable.grantReadWriteData(userCrudLambdaRole);

    // Lambda function for User CRUD operations
    const userCrudLambda = new lambda.Function(this, "UserCrudLambda", {
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambdaArchitecture,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/user-crud"),
      role: userCrudLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        USER_TABLE_NAME: userTable.tableName,
      },
      description: "CRUD operations for User Information DynamoDB table",
    });

    // ========================================
    // REST API Gateway with Response Streaming
    // ========================================

    // IAM Role for API Gateway to write to CloudWatch Logs
    const apiGatewayCloudWatchRole = new iam.Role(this, "ApiGatewayCloudWatchRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          "ApiGatewayPushToCloudWatch",
          "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
        ),
      ],
    });

    // API Gateway Account Configuration (required for CloudWatch logging)
    const apiGatewayAccount = new apigateway.CfnAccount(this, "ApiGatewayAccount", {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    // CloudWatch Log Group for API Gateway Access Logs
    const apiAccessLogs = new logs.LogGroup(this, "ApiGatewayAccessLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // REST API with response streaming support
    const api = new apigateway.RestApi(this, "MuseumChatbotApi", {
      restApiName: "Museum Chatbot API",
      description: "REST API for Museum Chatbot with response streaming support",
      deployOptions: {
        stageName: "prod",
        accessLogDestination: new apigateway.LogGroupLogDestination(apiAccessLogs),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    // Add CORS headers to all Gateway error responses (4xx, 5xx)
    // This ensures CORS headers are present even when Lambda fails or auth fails
    // Without this, browser shows confusing "CORS error" instead of actual error (401, 500, etc.)
    const corsResponseHeaders = {
      "Access-Control-Allow-Origin": "'*'",
      "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
    };

    // Add CORS to DEFAULT_4XX responses (includes 401 Unauthorized, 403 Forbidden)
    api.addGatewayResponse("GatewayResponse4XX", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsResponseHeaders,
    });

    // Add CORS to DEFAULT_5XX responses (includes 500, 502, 503, 504)
    api.addGatewayResponse("GatewayResponse5XX", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsResponseHeaders,
    });

    // Ensure API is created after the account configuration
    api.node.addDependency(apiGatewayAccount);

    // Create /chat resource
    const chatResource = api.root.addResource("chat");

    // Lambda integration with response streaming enabled
    // Uses ResponseTransferMode.STREAM for streaming responses
    const streamingIntegration = new apigateway.LambdaIntegration(invokeKbStreamLambda, {
      proxy: true,
      responseTransferMode: apigateway.ResponseTransferMode.STREAM,
    });

    // POST /chat - Streaming chat endpoint
    chatResource.addMethod("POST", streamingIntegration);

    // Create /feedback resource for submitting conversation feedback
    // NOTE: This will be configured later to use adminApiLambda (non-streaming)
    const feedbackResource = api.root.addResource("feedback");

    // ========================================
    // Cognito User Pool for Admin Authentication
    // ========================================

    const adminUserPool = new cognito.UserPool(this, "AdminUserPoolV2", {
      userPoolName: "MuseumChatbot-AdminPool",
      selfSignUpEnabled: false, // Only admins can create users
      signInAliases: {
        email: true, // Use email as the sign-in identifier
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // App client for the admin dashboard
    const adminAppClient = adminUserPool.addClient("AdminAppClient", {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false, // For browser-based apps
      preventUserExistenceErrors: true,
    });

    // ========================================
    // Admin API Lambda Function
    // ========================================

    const adminApiLambda = new lambda.Function(this, "AdminApiLambda", {
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambdaArchitecture,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin-api"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        CONVERSATION_HISTORY_TABLE: conversationHistoryTable.tableName,
        USER_TABLE_NAME: userTable.tableName,
        DATE_INDEX: "date-timestamp-index",
        FEEDBACK_INDEX: "feedback-timestamp-index",
      },
      description: "Admin API for dashboard analytics and conversation management",
    });

    // Grant read access to conversation history table
    conversationHistoryTable.grantReadData(adminApiLambda);
    
    // Grant write access for feedback updates
    conversationHistoryTable.grantWriteData(adminApiLambda);

    // Grant read access to user table for admin dashboard
    userTable.grantReadData(adminApiLambda);

    // ========================================
    // Feedback Endpoint (uses Admin API Lambda - no streaming)
    // ========================================
    
    // Feedback integration using adminApiLambda (non-streaming, avoids Lambda Web Adapter issues)
    const feedbackIntegration = new apigateway.LambdaIntegration(adminApiLambda, {
      proxy: true,
    });

    // POST /feedback - Submit feedback for a conversation (no auth required)
    feedbackResource.addMethod("POST", feedbackIntegration);

    // ========================================
    // Admin API Gateway (Cognito Authorized)
    // ========================================

    // Cognito authorizer for admin API
    const adminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "AdminAuthorizer", {
      cognitoUserPools: [adminUserPool],
    });

    // Create /admin resource on the existing API
    const adminResource = api.root.addResource("admin");

    // Admin Lambda integration
    const adminIntegration = new apigateway.LambdaIntegration(adminApiLambda, {
      proxy: true,
    });

    // GET /admin/stats - Get dashboard statistics (protected)
    const statsResource = adminResource.addResource("stats");
    statsResource.addMethod("GET", adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /admin/conversations - Get conversation list (protected)
    const conversationsResource = adminResource.addResource("conversations");
    conversationsResource.addMethod("GET", adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /admin/conversations/{id} - Get single conversation (protected)
    const conversationByIdResource = conversationsResource.addResource("{conversationId}");
    conversationByIdResource.addMethod("GET", adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /admin/feedback - Get feedback summary (protected)
    const feedbackSummaryResource = adminResource.addResource("feedback-summary");
    feedbackSummaryResource.addMethod("GET", adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    new AwsCustomResource(this, "TriggerAmplifyBuild", {
      onCreate: {
        service: "Amplify",
        action: "startJob",
        parameters: {
          appId: amplifyApp.appId,
          branchName: mainBranch.branchName, // e.g. "main"
          jobType: "RELEASE", // or REBUILD / RETRY / etc.
        },
        // ensure a new physical ID on every deploy so it actually runs each time
        physicalResourceId: PhysicalResourceId.of(
          `${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`
        ),
      },
      // if you also want it on updates:
      onUpdate: {
        service: "Amplify",
        action: "startJob",
        parameters: {
          appId: amplifyApp.appId,
          branchName: mainBranch.branchName,
          jobType: "RELEASE",
        },
        physicalResourceId: PhysicalResourceId.of(
          `${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`
        ),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          // the app itself
          `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyApp.appId}`,
          // allow startJob on any branch/job under your "main" branch
          `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyApp.appId}/branches/${mainBranch.branchName}/jobs/*`,
        ],
      }),
    });

    // ========================================
    // Amplify Environment Variables
    // ========================================
    // Add environment variables to the Amplify branch for the frontend
    mainBranch.addEnvironment("NEXT_PUBLIC_CHAT_API_URL", `${api.url}chat`);
    mainBranch.addEnvironment("NEXT_PUBLIC_ADMIN_API_URL", `${api.url}admin`);
    mainBranch.addEnvironment("NEXT_PUBLIC_USERS_API_URL", `${api.url}users`);
    mainBranch.addEnvironment("NEXT_PUBLIC_COGNITO_USER_POOL_ID", adminUserPool.userPoolId);
    mainBranch.addEnvironment("NEXT_PUBLIC_COGNITO_CLIENT_ID", adminAppClient.userPoolClientId);
    mainBranch.addEnvironment("NEXT_PUBLIC_AWS_REGION", aws_region);

    // Add same environment variables to feature branch
    featureBranch.addEnvironment("NEXT_PUBLIC_CHAT_API_URL", `${api.url}chat`);
    featureBranch.addEnvironment("NEXT_PUBLIC_ADMIN_API_URL", `${api.url}admin`);
    featureBranch.addEnvironment("NEXT_PUBLIC_USERS_API_URL", `${api.url}users`);
    featureBranch.addEnvironment("NEXT_PUBLIC_COGNITO_USER_POOL_ID", adminUserPool.userPoolId);
    featureBranch.addEnvironment("NEXT_PUBLIC_COGNITO_CLIENT_ID", adminAppClient.userPoolClientId);
    featureBranch.addEnvironment("NEXT_PUBLIC_AWS_REGION", aws_region);

    // ========================================
    // User Registration API (Public - POST only)
    // ========================================

    // Create /users resource (public endpoint for user self-registration)
    const usersResource = api.root.addResource("users");

    // Lambda integration for user CRUD operations
    const userCrudIntegration = new apigateway.LambdaIntegration(userCrudLambda, {
      proxy: true,
    });

    // POST /users - Create user (public, no auth required)
    usersResource.addMethod("POST", userCrudIntegration);

    // ========================================
    // Admin User Management API (Protected - Cognito Auth)
    // ========================================

    // Create /admin/users resource under existing /admin
    const adminUsersResource = adminResource.addResource("users");

    // GET /admin/users - List all users (protected) - uses admin-api Lambda
    adminUsersResource.addMethod("GET", adminIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Create /admin/users/{userId} resource
    const adminUserByIdResource = adminUsersResource.addResource("{userId}");

    // GET /admin/users/{userId} - Get single user (protected)
    adminUserByIdResource.addMethod("GET", userCrudIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /admin/users/{userId} - Update user (protected)
    adminUserByIdResource.addMethod("PUT", userCrudIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE /admin/users/{userId} - Delete user (protected)
    adminUserByIdResource.addMethod("DELETE", userCrudIntegration, {
      authorizer: adminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, "MuseumDataBucketName", {
      value: museumDataBucket.bucketName,
      description: "S3 bucket for museum documents (upload your PDFs, images, and text files here)",
    });

    new cdk.CfnOutput(this, "SupplementalDataBucketName", {
      value: supplementalDataBucket.bucketName,
      description: "S3 bucket for supplemental data (multimodal extracted images)",
    });

    new cdk.CfnOutput(this, "OpenSearchCollectionEndpoint", {
      value: vectorCollection.collectionEndpoint,
      description: "OpenSearch Serverless Collection Endpoint",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: knowledgeBase.attrKnowledgeBaseId,
      description: "Bedrock Knowledge Base ID",
    });

    new cdk.CfnOutput(this, "InvokeKbLambdaName", {
      value: invokeKbLambda.functionName,
      description: "Lambda function name for invoking Knowledge Base",
    });

    new cdk.CfnOutput(this, "ChatApiUrl", {
      value: `${api.url}chat`,
      description: "API Gateway URL for streaming chat endpoint (POST /chat)",
    });

    new cdk.CfnOutput(this, "FeedbackApiUrl", {
      value: `${api.url}feedback`,
      description: "API Gateway URL for feedback endpoint (POST /feedback)",
    });

    new cdk.CfnOutput(this, "UserTableName", {
      value: userTable.tableName,
      description: "DynamoDB table for storing user information",
    });

    new cdk.CfnOutput(this, "ConversationHistoryTableName", {
      value: conversationHistoryTable.tableName,
      description: "DynamoDB table for storing conversation history and analytics",
    });

    // Admin Dashboard Outputs
    new cdk.CfnOutput(this, "AdminUserPoolId", {
      value: adminUserPool.userPoolId,
      description: "Cognito User Pool ID for admin authentication",
    });

    new cdk.CfnOutput(this, "AdminUserPoolClientId", {
      value: adminAppClient.userPoolClientId,
      description: "Cognito App Client ID for admin dashboard",
    });

    new cdk.CfnOutput(this, "AdminApiUrl", {
      value: `${api.url}admin`,
      description: "API Gateway URL for admin endpoints (requires Cognito auth)",
    });

    // Public URL base for accessing images in the public/ prefix
    new cdk.CfnOutput(this, "PublicAssetsUrl", {
      value: `https://${museumDataBucket.bucketRegionalDomainName}/public`,
      description: "Base URL for publicly accessible museum assets (images in public/ prefix)",
    });

    new cdk.CfnOutput(this, "AmplifyAppUrl", {
      value: `https://main.${amplifyApp.defaultDomain}`,
      description: "Amplify hosted frontend URL",
    });

    new cdk.CfnOutput(this, "UserCrudLambdaArn", {
      value: userCrudLambda.functionArn,
      description: "Lambda function ARN for User CRUD operations",
    });

    new cdk.CfnOutput(this, "UserRegistrationApiUrl", {
      value: `${api.url}users`,
      description: "API Gateway URL for public user registration (POST /users only)",
    });

    new cdk.CfnOutput(this, "AdminUsersApiUrl", {
      value: `${api.url}admin/users`,
      description: "API Gateway URL for admin user management (GET, PUT, DELETE - requires Cognito auth)",
    });
  }
}