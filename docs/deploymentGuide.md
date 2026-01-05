# Deployment Guide

This guide provides step-by-step instructions for deploying the Cincinnati Museum Chatbot.

---

## Common Prerequisites

### 1. Fork the Repository

Fork this repository to your own GitHub account (required for deployment and CI/CD):

1. Navigate to the repository on GitHub
2. Click the **"Fork"** button in the top right corner
3. Select your GitHub account as the destination
4. Wait for the forking process to complete
5. You'll now have your own copy at `https://github.com/YOUR-USERNAME/Cincinnati-Museum-Chatbot`

### 2. Obtain a GitHub Personal Access Token

A GitHub personal access token with repo permissions is needed for CDK deployment:

1. Go to **GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Give the token a descriptive name (e.g., "CMC Chatbot Deployment")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)
5. Click **"Generate token"** and save the token securely

> **Important**: Save this token immediately - you won't be able to see it again!

For detailed instructions, see: [GitHub Personal Access Tokens Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

### 4. AWS Account Permissions

Ensure your AWS account has permissions to create and manage the following resources:

- CloudFormation
- Lambda
- API Gateway
- S3
- DynamoDB
- Bedrock (Knowledge Bases, Agents)
- OpenSearch Serverless
- Cognito
- Amplify
- Secrets Manager
- IAM Roles and Policies
- CloudWatch Logs

---

## Deployment Using AWS CodeBuild and CloudShell

This is the **recommended deployment method**.

### Prerequisites

- Access to AWS CloudShell
- AWS account with CodeBuild permissions

### Deployment Steps

#### 1. Open AWS CloudShell

1. Log in to the AWS Console
2. Click the **CloudShell icon** in the AWS Console navigation bar (terminal icon)
3. Wait for the CloudShell environment to initialize

#### 2. Clone Your Forked Repository

```bash
git clone https://github.com/YOUR-USERNAME/Cincinnati-Museum-Chatbot
cd Cincinnati-Museum-Chatbot/
```

> **Important**: Replace `YOUR-USERNAME` with your actual GitHub username.

#### 3. Run the Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will prompt you for:

| Prompt | Description | Example |
|--------|-------------|---------|
| GitHub repository URL | Your forked repo URL | `https://github.com/yourname/Cincinnati-Museum-Chatbot` |
| GitHub Token | Personal access token from prerequisites | `ghp_xxxxxxxxxxxx` |
| Action | Deploy or destroy | `deploy` |

The script will:
1. Create an IAM service role for CodeBuild
2. Create a CodeBuild project
3. Start the build which deploys all infrastructure via CDK

#### 4. Monitor the Build

After starting the build:

1. Go to **AWS Console > CodeBuild > Build projects**
2. Click on the project name (e.g., `CincyMuseum-20250105123456`)
3. Click on the running build to view logs
4. Wait for the build to complete (typically 5-15 minutes)

---

## Manual CDK Deployment

Use this method if you prefer to deploy from your local machine.

### Prerequisites

- **AWS CLI** (v2.x) - [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **Node.js** (v18.x or later) - [Download Node.js](https://nodejs.org/)
- **AWS CDK** (v2.x) - Install via `npm install -g aws-cdk`
- **Docker** - [Install Docker](https://docs.docker.com/get-docker/)

### Deployment Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/Cincinnati-Museum-Chatbot
cd Cincinnati-Museum-Chatbot/
```

#### 2. Configure AWS CLI

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-east-1` (recommended)
- Default output format: `json`

#### 3. Install Dependencies

```bash
cd backend
npm install
```

#### 4. Bootstrap CDK (First-time only)

```bash
cdk bootstrap \
  -c githubToken=YOUR_GITHUB_TOKEN \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c githubRepo=Cincinnati-Museum-Chatbot
```

#### 5. Deploy the Stack

```bash
cdk deploy \
  -c githubToken=YOUR_GITHUB_TOKEN \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c githubRepo=Cincinnati-Museum-Chatbot
```

When prompted, review the IAM changes and type `y` to confirm.

---

## Post-Deployment Steps

### 1. Upload Documents to S3

Upload your documents (PDFs, images, text files) to the S3 data bucket:

```bash
# Get the bucket name from CDK outputs (MuseumDataBucketName)

# Upload to public folder (files will be accessible in citations)
aws s3 cp your-document.pdf s3://YOUR-BUCKET-NAME/public/documents/

# Upload images
aws s3 cp your-image.jpg s3://YOUR-BUCKET-NAME/public/images/

# Upload entire folder
aws s3 sync ./my-documents/ s3://YOUR-BUCKET-NAME/public/documents/
```

> **Note**: Files in the `public/` prefix will have their URLs exposed in chat citations. Use the `private/` prefix for documents that should be indexed but not directly linked.

### 2. Sync the Knowledge Base

After uploading documents, sync the Knowledge Base to index your data:

1. Go to **AWS Console > Bedrock > Knowledge bases**
2. Select the knowledge base created by the stack
3. Click **"Sync"** for each data source
4. Wait for sync to complete (status will show "Available")

### 3. Create Admin User in Cognito

Create an admin user for the dashboard:

1. Go to **AWS Console > Cognito > User Pools**
2. Select the user pool created by the stack (e.g., `MuseumChatbot-AdminPool`)
3. Click **"Users"** tab > **"Create user"**
4. Fill in:
   - Username: admin email address
   - Email: same email address
   - Temporary password: a secure password
5. Click **"Create user"**

The user will reset their password on first login.

### 4. Access the Application

1. Go to **AWS Console > AWS Amplify**
2. Select the app created by the stack
3. Click on the **Amplify URL** to access the chatbot
4. Navigate to `/admin` to access the admin dashboard

---

## CDK Outputs

After deployment, note these important outputs:

| Output | Description |
|--------|-------------|
| `AmplifyAppUrl` | Frontend application URL |
| `ChatApiUrl` | Chat API endpoint |
| `AdminApiUrl` | Admin API endpoint |
| `KnowledgeBaseId` | Bedrock Knowledge Base ID |
| `MuseumDataBucketName` | S3 bucket for uploading documents |
| `AdminUserPoolId` | Cognito User Pool ID |
| `AdminUserPoolClientId` | Cognito App Client ID |

---

## Troubleshooting

### CodeBuild Errors

**Error**: "Build failed"
- Check CloudWatch logs for detailed error messages
- Verify your GitHub token has correct permissions
- Ensure Bedrock models are enabled in your region

### CDK Bootstrap Error

**Error**: "This stack uses assets, so the toolkit stack must be deployed"

**Solution**:
```bash
cdk bootstrap aws://ACCOUNT_ID/REGION \
  -c githubToken=YOUR_TOKEN \
  -c githubOwner=YOUR_USERNAME \
  -c githubRepo=Cincinnati-Museum-Chatbot
```

### Permission Denied

**Error**: Access denied errors during deployment

**Solution**:
- Verify your AWS credentials are configured correctly
- Ensure your IAM user/role has the required permissions
- Check if you're deploying to the correct region

### Knowledge Base Not Responding

**Error**: Chat returns empty or error responses

**Solution**:
1. Verify the Bedrock knowledge base is properly synced
2. Check if the S3 bucket contains data files
3. Ensure the Lambda function has proper IAM permissions
4. Check CloudWatch logs for the streaming Lambda

### Amplify Build Failed

**Error**: Frontend deployment failed

**Solution**:
1. Check Amplify build logs in the AWS Console
2. Verify the GitHub token has repo access
3. Ensure the `frontend/` directory exists with valid Next.js app

---

## Cleanup

To remove all deployed resources:

### Using deploy.sh
```bash
./deploy.sh
# When prompted, enter: destroy
```

### Using CDK directly
```bash
cd backend
cdk destroy \
  -c githubToken=YOUR_TOKEN \
  -c githubOwner=YOUR_USERNAME \
  -c githubRepo=Cincinnati-Museum-Chatbot
```

> **Warning**: This will delete all resources including data in S3 and DynamoDB. Backup important data before proceeding.

---

## Next Steps

After successful deployment:

1. Review the [User Guide](./userGuide.md) to learn how to use the application
2. Check the [API Documentation](./APIDoc.md) for integration details
3. See the [Modification Guide](./modificationGuide.md) for customization options

