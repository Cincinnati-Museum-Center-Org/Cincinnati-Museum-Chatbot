
# CONTEXT.md

## Project: CincyMuse — Cincinnati Museum Center AI Chatbot

**Purpose:**  
AI-powered chatbot for museum visitors and staff. Provides instant answers about exhibits, tickets, hours, collections, and more. Features a Next.js frontend, AWS Lambda backend, and Bedrock Knowledge Base integration.

---

## Key Features

- AI chat (Claude 3.5 Sonnet, AWS Bedrock KB)
- Bilingual (English/Spanish)
- Real-time streaming responses
- Citations with source references
- Admin dashboard (analytics, feedback, support)
- Responsive design

---

## Architecture

- **Frontend:** Next.js (TypeScript), Tailwind CSS, hosted on AWS Amplify  
	- Main: `frontend/app/page.tsx`
	- Admin: `frontend/app/admin/`, `frontend/app/dashboard/`
- **Backend:** AWS Lambda (Python), API Gateway, DynamoDB, Cognito  
	- CDK infra: `backend/lib/backend-stack.ts`
	- Lambdas: `backend/lambda/`
		- Admin API: `admin-api/`
		- Chatbot: `chatbot/`, `invoke-kb/`, `invoke-kb-stream/`
		- User CRUD: `user-crud/`
		- Webcrawler: `webcrawler/`
- **Docs:**  
	- Architecture: `docs/architectureDeepDive.md`
	- Deployment: `docs/deploymentGuide.md`
	- API: `docs/APIDoc.md`
	- User: `docs/userGuide.md`
	- Modification: `docs/modificationGuide.md`

---

## Directory Structure

See [README.md](README.md) for a full tree. Key paths:
- `frontend/` — Next.js app, UI, admin, components, config
- `backend/` — CDK infra, Lambda code, tests
- `docs/` — All project documentation
- `deploy.sh`, `buildspec.yml` — Deployment/CI scripts

---

## Key Commands

- **Frontend:**  
	- Dev: `cd frontend && npm run dev`
	- Build: `npm run build`
	- Lint: `npm run lint`
- **Backend:**  
	- Dev: `cd backend && npm run watch`
	- Build: `npm run build`
	- Test: `npm run test`
	- Deploy: `cdk deploy --all`
- **Lambdas:**  
	- Install: `pip install -r requirements.txt` (per lambda dir)
	- Run: `run.sh` (where present)

---

## Conventions & Rules

- **Branching:** Feature branches, PRs required for `main`
- **Commits:** Conventional Commits (`feat:`, `fix:`, etc.)
- **Reviews:** All code changes require PR review
- **Secrets:** Never commit secrets; use env vars or AWS Secrets Manager
- **Infra:** All infra via CDK, no manual AWS console edits
- **Testing:** All new features require tests (Jest for TS, pytest for Python if needed)
- **Docs:** Update docs for any major change

---

## Ruleset for Agents

- Always reference this CONTEXT.md for project context and rules.
- Never commit secrets, credentials, or sensitive data.
- Do not modify files in `docs/media/` or any binary assets unless explicitly requested.
- Always update or reference documentation when making significant code changes.
- Ask for clarification if requirements are ambiguous or if a change could impact multiple subsystems.
- Prefer small, focused changes and PRs.
- Do not refactor large portions of the codebase without explicit approval.
- Follow all conventions and best practices listed above.
- If unsure, add questions to the “Questions for Maintainers” section or request review.

---

## Skills (Trigger-Only)

> **Agents must only use these skills if the user’s prompt contains the relevant trigger word/phrase.**

### add documentation
- **When to use:** When the user prompt requests documentation.
- **Steps:** Add or update docstrings, comments, or markdown files (e.g., README.md, docs/). Document API endpoints, scripts, and modules with purpose, usage, and examples.

### add tests
- **When to use:** When the user prompt requests tests.
- **Steps:** Create or update test files (e.g., test/*.test.ts for backend, __tests__ for frontend). Use Jest for backend TypeScript tests. Ensure tests cover new logic and edge cases.

### run build
- **When to use:** When the user prompt requests a build.
- **Steps:** Frontend: `npm run build`. Backend: `npm run build`.

### run lint
- **When to use:** When the user prompt requests linting.
- **Steps:** Frontend: `npm run lint` (ESLint). Fix reported issues or auto-fix where possible.

### deploy
- **When to use:** When the user prompt requests deployment.
- **Steps:** Run `deploy.sh` and follow prompts. Use AWS CDK for backend infra (`npm run cdk` in backend).

### update dependencies
- **When to use:** When the user prompt requests dependency updates.
- **Steps:** Run `npm install` or `npm update` in frontend/backend. For Python, update `requirements.txt` as needed.

### scrape data
- **When to use:** When the user prompt requests data scraping.
- **Steps:** Run Python scripts in backend/lambda/webcrawler/scripts/ (e.g., `scrape_cmc_photos.py`, `scrape_cmc_events.py`). Prepare data with `prepare_for_bedrock_kb.py`.

### start development server
- **When to use:** When the user prompt requests starting a dev server.
- **Steps:** Frontend: `npm run dev`. Backend: use local emulation or test Lambda functions as needed.

### run tests
- **When to use:** When the user prompt requests running tests.
- **Steps:** Backend: `npm test` (Jest). Ensure all tests pass.

### serve production build
- **When to use:** When the user prompt requests serving a production build.
- **Steps:** Frontend: `npm start` after building.

### run backend lambda locally
- **When to use:** When the user prompt requests running a backend Lambda locally.
- **Steps:** Use provided shell scripts or Python commands in lambda directories.

---

## Gotchas & Tips

- Each Lambda is self-contained; install dependencies in its directory
- Scraper scripts may need updates if museum site changes
- If CDK deploy fails, try clearing `cdk.context.json`
- Keep API contracts in sync between frontend and backend
- Do not commit large scraped data files unless necessary

---

## Reference Links

- [README.md](README.md)
- [Architecture Deep Dive](docs/architectureDeepDive.md)
- [Deployment Guide](docs/deploymentGuide.md)
- [API Documentation](docs/APIDoc.md)
- [User Guide](docs/userGuide.md)
- [Modification Guide](docs/modificationGuide.md)

_Last updated: 2026-02-13_