# CincyMuse - Cincinnati Museum Center AI Chatbot

An intelligent AI-powered chatbot that helps visitors explore the Cincinnati Museum Center, providing instant answers about exhibits, tickets, hours, collections, and more. Built with AWS Bedrock Knowledge Base and a modern Next.js frontend.

## Demo Video

<p align="center">
  <img src="./docs/media/user-interface.gif" alt="CincyMuse Demo" width="640" />
</p>

> **Note:** Please add a demo GIF at `docs/media/user-interface.gif`

## Index

| Description | Link |
|-------------|------|
| Overview | [Overview](#overview) |
| Architecture | [Architecture](#architecture-diagram) |
| Detailed Architecture | [Architecture Deep Dive](docs/architectureDeepDive.md) |
| Deployment | [Deployment Guide](docs/deploymentGuide.md) |
| User Guide | [User Guide](docs/userGuide.md) |
| API Documentation | [API Documentation](docs/APIDoc.md) |
| Modification Guide | [Modification Guide](docs/modificationGuide.md) |
| Credits | [Credits](#credits) |
| License | [License](#license) |

## Overview

CincyMuse is a conversational AI assistant designed for the Cincinnati Museum Center. It enables visitors to get instant, accurate information about the museum through natural language conversations, supporting both English and Spanish.

### Key Features

- **AI-Powered Conversations** using AWS Bedrock with Claude 3.5 Sonnet
- **Knowledge Base Integration** with museum website content and collections data
- **Bilingual Support** for English and Spanish visitors
- **Real-time Streaming Responses** for a natural chat experience
- **Citation Support** with source references for transparency
- **Admin Dashboard** for monitoring conversations, feedback, and analytics
- **Support Request System** for visitor inquiries that need human follow-up
- **Responsive Design** optimized for both desktop and mobile devices

## Architecture Diagram

![Architecture Diagram](./docs/media/architecture.png)

The application implements a serverless architecture on AWS, combining:

- **Frontend**: Next.js application hosted on AWS Amplify
- **Backend**: AWS CDK-deployed infrastructure with API Gateway and Lambda
- **AI Layer**: AWS Bedrock Knowledge Base with web-crawled museum content
- **Data Storage**: DynamoDB for conversation history, user data, and analytics
- **Authentication**: Amazon Cognito for admin dashboard access

For a detailed deep dive into the architecture, see [docs/architectureDeepDive.md](docs/architectureDeepDive.md).

## Deployment

For detailed deployment instructions, including prerequisites and step-by-step guides, see [docs/deploymentGuide.md](docs/deploymentGuide.md).

## User Guide

For detailed usage instructions with screenshots, see [docs/userGuide.md](docs/userGuide.md).

## API Documentation

For complete API reference including chat endpoints, admin APIs, and user management, see [docs/APIDoc.md](docs/APIDoc.md).

## Modification Guide

For developers looking to extend or customize this project, see [docs/modificationGuide.md](docs/modificationGuide.md).

## Directory Structure

```
├── backend/
│   ├── bin/
│   │   └── backend.ts              # CDK app entry point
│   ├── lambda/
│   │   ├── admin-api/              # Admin dashboard API handlers
│   │   ├── chatbot/                # Main chat Lambda with streaming
│   │   ├── invoke-kb/              # Knowledge Base invocation
│   │   ├── invoke-kb-stream/       # Streaming KB responses
│   │   ├── user-crud/              # User management CRUD operations
│   │   └── webcrawler/             # Museum website scraper
│   ├── lib/
│   │   └── backend-stack.ts        # Main CDK stack definition
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── admin/                  # Admin login page
│   │   ├── dashboard/              # Admin dashboard with analytics
│   │   ├── components/             # Reusable UI components
│   │   ├── context/                # React contexts (auth, language)
│   │   ├── config/                 # App configuration
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Main chatbot interface
│   │   └── globals.css
│   ├── public/
│   └── package.json
├── docs/
│   ├── architectureDeepDive.md
│   ├── deploymentGuide.md
│   ├── userGuide.md
│   ├── APIDoc.md
│   ├── modificationGuide.md
│   └── media/
├── LICENSE
└── README.md
```

## Credits

This application was developed by:

**Associate Cloud Developers:**
- <a href="https://www.linkedin.com/in/aryankhanna2004/" target="_blank">Aryan Khanna</a>
- <a href="https://www.linkedin.com/in/sreeram-sreedhar/" target="_blank">Sreeram Sreedhar</a>

**UI/UX Designers:**
- <a href="https://www.linkedin.com/in/jennnyen/" target="_blank">Jenny Nguyen</a>
- <a href="https://www.linkedin.com/in/pshristi/" target="_blank">Shristi Pathak</a>

Built in collaboration with the ASU Cloud Innovation Center and Cincinnati Museum Center.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
