# content-reviewer-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_content-reviewer-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_content-reviewer-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_content-reviewer-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_content-reviewer-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_content-reviewer-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_content-reviewer-frontend)

A GOV.UK Design System compliant web application for AI-powered content review with integrated chat and document upload capabilities.

---

## 📚 Complete Documentation

**For comprehensive documentation, see [DOCUMENTATION.md](./DOCUMENTATION.md)**

The complete user guide includes:

- 🚀 Quick Start & Installation
- ✨ Features & Capabilities
- ⚙️ Configuration Guide
- 📤 File Upload System
- 📊 Review Results & Export
- 🌍 Environment Configuration
- ☁️ CDP Deployment Guide
- 🧪 Testing Guide
- 🔧 Troubleshooting
- 📖 API Reference
- 🏗️ Architecture Overview

---

## Quick Links

| Section                                               | Description                |
| ----------------------------------------------------- | -------------------------- |
| [Quick Start](./DOCUMENTATION.md#quick-start)         | Get running in 30 seconds  |
| [Features](./DOCUMENTATION.md#features)               | What this application does |
| [Configuration](./DOCUMENTATION.md#configuration)     | Environment setup          |
| [File Upload](./DOCUMENTATION.md#file-upload-system)  | Upload system details      |
| [CDP Deployment](./DOCUMENTATION.md#cdp-deployment)   | Deploy to CDP platform     |
| [Troubleshooting](./DOCUMENTATION.md#troubleshooting) | Common issues & solutions  |
| [API Reference](./DOCUMENTATION.md#api-reference)     | API endpoints              |

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= v22
- npm >= v9

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start development server
npm run dev

# 4. Open browser
# Navigate to http://localhost:3000
```

**See [DOCUMENTATION.md](./DOCUMENTATION.md#quick-start) for detailed setup instructions.**

---

## 🎯 Key Features

- **📄 Document Upload** - Upload PDF and Word documents for AI review
- **💬 AI Chat Interface** - Interactive content guidance
- **📊 Review Results** - Detailed analysis with scoring
- **📥 Export Results** - PDF and Word format exports
- **🎨 GOV.UK Design** - Fully compliant with Design System

---

---

## 📋 Development Reference

### Requirements

- **Node.js:** >= v22
- **npm:** >= v9
- **Redis:** Latest (production only)

Use [nvm](https://github.com/creationix/nvm) for Node.js version management:

```bash
nvm install 22
nvm use 22
```

### NPM Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run dev:debug        # Start with debugging

# Production
npm start               # Production mode

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode

# Code Quality
npm run lint           # Lint code
npm run lint:js:fix    # Fix linting issues
npm run format         # Format code
npm run security-audit # Security check

# Build
npm run build:frontend  # Build frontend assets
```

### Environment Configuration

**See [DOCUMENTATION.md - Configuration](./DOCUMENTATION.md#configuration) for complete details.**

**Quick setup:**

```bash
cp .env.example .env
```

The application uses **smart configuration** that auto-computes values based on `ENVIRONMENT` variable:

- ✅ Backend URLs computed automatically
- ✅ S3 buckets mapped per environment
- ✅ Session storage auto-selected
- ✅ Only 1 variable needed in CDP: `ENVIRONMENT=dev`

---

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag content-reviewer-frontend`

Build:

```bash
docker build --target development --no-cache --tag content-reviewer-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 content-reviewer-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag content-reviewer-frontend .
```

Run:

```bash
docker run -p 3000:3000 content-reviewer-frontend
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
