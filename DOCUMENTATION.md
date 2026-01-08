# Content Reviewer Frontend - Complete User Guide

**Version:** 1.0  
**Last Updated:** January 2026  
**Service:** GOV.UK Content Review Tool - Frontend

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Features](#features)
4. [Installation & Setup](#installation--setup)
5. [Local Development](#local-development)
6. [Configuration](#configuration)
7. [File Upload System](#file-upload-system)
8. [Review Results & Export](#review-results--export)
9. [Environment Configuration](#environment-configuration)
10. [CDP Deployment](#cdp-deployment)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)
13. [API Reference](#api-reference)
14. [Architecture](#architecture)

---

## Overview

The Content Reviewer Frontend is a GOV.UK Design System compliant web application that provides:

- 📄 **Document Upload** - Upload PDF and Word documents for AI review
- 💬 **AI Chat Interface** - Interactive chat for content guidance
- 📊 **Review Results** - View detailed AI analysis with scoring
- 📥 **Export Results** - Download reports in PDF or Word format
- 🎨 **GOV.UK Design** - Fully compliant with GOV.UK Design System

### Technology Stack

- **Framework:** Node.js (v22+) with Hapi.js
- **Templating:** Nunjucks
- **Frontend:** GOV.UK Frontend, vanilla JavaScript
- **Styling:** SASS with GOV.UK Design System
- **Session Management:** Redis (production) or Memory (development)
- **File Upload:** Integration with backend S3 uploader

---

## Quick Start

### Prerequisites

- Node.js >= v22
- npm >= v9
- Backend API running (or configured backend URL)
- Redis (for production) or use memory cache (for local dev)

### 30-Second Setup

```bash
# 1. Clone and install
git clone <repository-url>
cd content-reviewer-frontend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env if needed (defaults work for local dev)

# 3. Start development server
npm run dev

# 4. Open browser
# Navigate to http://localhost:3000
```

**That's it!** The application will:

- Run on port 3000
- Connect to backend at `http://localhost:3001` (default)
- Use in-memory session cache (no Redis needed)
- Enable hot-reload for development

---

## Features

### 1. 📄 Document Upload

**Supported Formats:**

- PDF (`.pdf`)
- Microsoft Word (`.doc`, `.docx`)

**Features:**

- Drag & drop interface
- File size validation (max 10MB)
- Type validation
- Progress indicators
- Error handling with user-friendly messages

**Process:**

1. User uploads document via frontend UI
2. File is sent to backend API
3. Backend uploads to S3 bucket
4. Backend sends message to SQS queue for processing
5. User receives confirmation with upload ID

### 2. 💬 AI Chat Interface

**Capabilities:**

- Interactive chat with AI assistant
- Context-aware responses about content standards
- GOV.UK style guidance
- Accessibility best practices advice
- Multi-turn conversations

**Usage:**

```
User: How do I write accessible content?
AI: To write accessible content, follow these principles:
    1. Use clear, simple language...
    2. Break content into short paragraphs...
    [detailed guidance]
```

### 3. 📊 Review Results

**Displays:**

- Overall content score (0-100)
- Readability assessment
- Compliance with GOV.UK standards
- Detailed findings by section
- Actionable recommendations

**Scoring Categories:**

- **Excellent (90-100):** Meets all standards
- **Good (75-89):** Minor improvements needed
- **Fair (60-74):** Several improvements recommended
- **Needs Work (0-59):** Significant issues to address

### 4. 📥 Export Features

**Export Formats:**

- **PDF:** Professional report with branding
- **Word Document:** Editable format for collaboration

**Export Contents:**

- Document metadata
- Review summary
- Detailed findings
- Recommendations
- Scoring breakdown

**Usage:**

```javascript
// From review results page
Click "Export as PDF" or "Export as Word"
→ File downloads automatically
```

---

## Installation & Setup

### System Requirements

| Requirement | Version | Notes                          |
| ----------- | ------- | ------------------------------ |
| Node.js     | >= v22  | Use nvm for version management |
| npm         | >= v9   | Comes with Node.js             |
| Redis       | Latest  | Required for production only   |
| Git         | Latest  | For version control            |

### Step 1: Install Node.js

**Using nvm (Recommended):**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js
nvm install 22
nvm use 22

# Verify
node --version  # Should show v22.x.x
npm --version   # Should show v9.x.x
```

**Direct Installation:**
Download from [nodejs.org](https://nodejs.org/) (v22 LTS)

### Step 2: Clone Repository

```bash
git clone <repository-url>
cd content-reviewer-frontend
```

### Step 3: Install Dependencies

```bash
npm install
```

This installs:

- Hapi.js framework
- GOV.UK Frontend
- Nunjucks templating
- Session management
- Development tools

### Step 4: Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit for local development
nano .env
```

**Minimal local configuration:**

```bash
NODE_ENV=development
ENVIRONMENT=local
PORT=3000
BACKEND_URL=http://localhost:3001
SESSION_CACHE_ENGINE=memory
LOG_LEVEL=debug
LOG_FORMAT=pino-pretty
```

### Step 5: Start Application

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

### Step 6: Verify Installation

Open browser to `http://localhost:3000`

**You should see:**

- GOV.UK styled homepage
- Navigation menu
- Upload form
- Chat interface link

---

## Local Development

### Development Scripts

```bash
# Start with hot reload
npm run dev

# Start with debugging
npm run dev:debug

# Build frontend assets only
npm run build:frontend

# Watch frontend changes
npm run frontend:watch

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:js:fix

# Format code
npm run format

# Security audit
npm run security-audit
```

### Development Workflow

1. **Start development server:**

   ```bash
   npm run dev
   ```

   - Frontend: Watches and rebuilds assets
   - Backend: Watches and restarts server on changes

2. **Make changes:**
   - Edit files in `src/`
   - Server auto-restarts
   - Frontend auto-rebuilds

3. **Test changes:**
   - Browser auto-refreshes (if using browser-sync)
   - Check console for errors
   - Review logs in terminal

4. **Commit changes:**
   ```bash
   npm run format          # Format code
   npm run lint           # Check linting
   npm test              # Run tests
   git add .
   git commit -m "Description"
   ```

### Project Structure

```
content-reviewer-frontend/
├── src/
│   ├── index.js                    # Application entry point
│   ├── client/                     # Frontend assets
│   │   ├── javascripts/           # Client-side JS
│   │   │   ├── application.js     # Main JS bundle
│   │   │   └── upload-handler.js  # File upload logic
│   │   └── stylesheets/           # SASS/CSS
│   │       ├── application.scss   # Main stylesheet
│   │       └── components/        # Component styles
│   ├── config/
│   │   ├── config.js              # Smart configuration
│   │   └── nunjucks/              # Template configuration
│   └── server/
│       ├── server.js              # Hapi server setup
│       ├── router.js              # Route definitions
│       ├── home/                  # Homepage route
│       ├── about/                 # About page route
│       ├── upload/                # Upload routes
│       ├── chat/                  # Chat interface (future)
│       ├── review/                # Review results
│       │   └── results/           # Results display & export
│       └── common/                # Shared utilities
│           ├── components/        # Nunjucks components
│           ├── templates/         # Base templates
│           └── helpers/           # Utility functions
├── .env.example                   # Environment template
├── package.json                   # Dependencies & scripts
├── vitest.config.js              # Test configuration
├── webpack.config.js             # Frontend build config
└── nodemon.json                  # Dev server config
```

### Key Files Explained

**`src/index.js`**

- Application entry point
- Starts the Hapi server
- Loads configuration

**`src/server/server.js`**

- Hapi server setup
- Plugin registration
- Route registration

**`src/config/config.js`**

- Environment-aware configuration
- Auto-computes URLs based on ENVIRONMENT
- Manages all app settings

**`src/server/router.js`**

- Defines all application routes
- Maps URLs to controllers

**`src/client/javascripts/upload-handler.js`**

- Client-side file upload logic
- Drag & drop functionality
- Progress tracking

---

## Configuration

### Smart Configuration System

The application uses **smart defaults** that automatically compute values based on the `ENVIRONMENT` variable.

### Configuration File: `src/config/config.js`

**Auto-Computed Values:**

```javascript
// Detects environment
const cdpEnvironment = process.env.ENVIRONMENT || 'local'
const isLocal = cdpEnvironment === 'local'

// Auto-computes backend URL
const getBackendUrl = () => {
  if (isLocal) return 'http://localhost:3001'
  return `https://content-reviewer-backend.${cdpEnvironment}.cdp-int.defra.cloud`
}

// Auto-selects S3 bucket
const getS3Bucket = () => {
  if (isLocal) return 'dev-service-optimisation-c63f2'
  const bucketMap = {
    dev: 'dev-service-optimisation-c63f2',
    test: 'test-service-optimisation-bucket',
    'perf-test': 'perf-test-service-optimisation-bucket',
    prod: 'prod-service-optimisation-bucket'
  }
  return bucketMap[cdpEnvironment]
}
```

### Environment Variables

#### Core Settings

| Variable      | Default       | Description                                     |
| ------------- | ------------- | ----------------------------------------------- |
| `NODE_ENV`    | `development` | Node environment (development/production)       |
| `ENVIRONMENT` | `local`       | CDP environment (local/dev/test/perf-test/prod) |
| `PORT`        | `3000`        | Server port                                     |
| `HOST`        | `0.0.0.0`     | Server host                                     |

#### Backend Integration

| Variable                 | Auto-Computed     | Description                                 |
| ------------------------ | ----------------- | ------------------------------------------- |
| `BACKEND_URL`            | Yes               | Backend API URL (computed from ENVIRONMENT) |
| `CDP_UPLOADER_URL`       | Yes               | Same as BACKEND_URL                         |
| `CDP_UPLOADER_S3_BUCKET` | Yes               | S3 bucket (computed from ENVIRONMENT)       |
| `CDP_UPLOADER_S3_PATH`   | `content-uploads` | S3 prefix for uploads                       |

#### Session Management

| Variable                  | Default                         | Description      |
| ------------------------- | ------------------------------- | ---------------- |
| `SESSION_CACHE_ENGINE`    | `memory` (local), `redis` (CDP) | Session storage  |
| `SESSION_COOKIE_PASSWORD` | Generated                       | 32+ char secret  |
| `SESSION_CACHE_TTL`       | `14400000` (4 hours)            | Session duration |

#### Redis Configuration

| Variable                    | Default             | Description                       |
| --------------------------- | ------------------- | --------------------------------- |
| `REDIS_HOST`                | `127.0.0.1`         | Redis hostname                    |
| `REDIS_USERNAME`            | ``                  | Redis username                    |
| `REDIS_PASSWORD`            | ``                  | Redis password (from CDP Secrets) |
| `REDIS_TLS`                 | `true` (production) | Enable TLS                        |
| `USE_SINGLE_INSTANCE_CACHE` | `true` (local)      | Single instance vs cluster        |

#### Logging

| Variable      | Default                           | Description    |
| ------------- | --------------------------------- | -------------- |
| `LOG_LEVEL`   | `info` (prod), `debug` (dev)      | Log verbosity  |
| `LOG_FORMAT`  | `ecs` (prod), `pino-pretty` (dev) | Log format     |
| `LOG_ENABLED` | `true`                            | Enable logging |

#### Security

| Variable                | Default             | Description              |
| ----------------------- | ------------------- | ------------------------ |
| `ENABLE_SECURE_CONTEXT` | `true` (production) | Enable security headers  |
| `ENABLE_METRICS`        | `true` (production) | Enable metrics reporting |

### Environment Examples

**Local Development (`.env`):**

```bash
NODE_ENV=development
ENVIRONMENT=local
PORT=3000
BACKEND_URL=http://localhost:3001
SESSION_CACHE_ENGINE=memory
LOG_LEVEL=debug
LOG_FORMAT=pino-pretty
```

**CDP Dev (via Portal - only set this):**

```bash
ENVIRONMENT=dev
# Everything else is auto-computed!
```

**CDP Production (via Portal):**

```bash
ENVIRONMENT=prod
LOG_LEVEL=warn
# Backend URL, S3 bucket auto-computed
# Secrets from CDP Secrets Manager
```

---

## File Upload System

### Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────┐       ┌─────────┐
│  Frontend   │──────▶│   Backend    │──────▶│   S3    │──────▶│   SQS   │
│   Browser   │ POST  │   API        │ Upload│ Bucket  │ Notify│  Queue  │
└─────────────┘       └──────────────┘       └─────────┘       └─────────┘
                            │
                            ▼
                      ┌──────────────┐
                      │  SQS Worker  │
                      │ (Processing) │
                      └──────────────┘
```

### Upload Flow

1. **User selects file** in browser (drag & drop or file picker)
2. **JavaScript validates** file type and size
3. **FormData created** with file and metadata
4. **POST request** to backend `/upload` endpoint
5. **Backend validates** and uploads to S3
6. **Backend sends SQS message** for processing
7. **Response returned** with upload ID and S3 location
8. **UI updated** with confirmation

### Frontend Implementation

**File: `src/client/javascripts/upload-handler.js`**

```javascript
// Drag & drop setup
setupDragAndDrop() {
  const dropZone = document.getElementById('upload-drop-zone')

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.classList.add('drag-over')
  })

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      this.handleFileUpload(files[0])
    }
  })
}

// File upload
async handleFileUpload(file) {
  // Validate
  if (!this.validateFile(file)) return

  // Create FormData
  const formData = new FormData()
  formData.append('file', file)

  // Upload with progress
  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    })

    if (response.ok) {
      const result = await response.json()
      this.showSuccess(result)
    } else {
      this.showError('Upload failed')
    }
  } catch (error) {
    this.showError(error.message)
  }
}
```

### Backend Route Handler

**File: `src/server/upload/controller.js`**

```javascript
export const uploadFile = {
  handler: async (request, h) => {
    const file = request.payload.file

    // Send to backend API
    const response = await fetch(`${config.get('backendUrl')}/upload`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    const result = await response.json()

    return h
      .response({
        success: true,
        uploadId: result.uploadId,
        s3Location: result.s3Location
      })
      .code(200)
  }
}
```

### Supported File Types

| Extension | MIME Type                                                                 | Max Size |
| --------- | ------------------------------------------------------------------------- | -------- |
| `.pdf`    | `application/pdf`                                                         | 10MB     |
| `.doc`    | `application/msword`                                                      | 10MB     |
| `.docx`   | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10MB     |

### Error Handling

**Client-Side Validation:**

```javascript
validateFile(file) {
  // Check file type
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowedTypes.includes(file.type)) {
    this.showError('Please upload a PDF or Word document')
    return false
  }

  // Check file size (10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    this.showError('File size must be less than 10MB')
    return false
  }

  return true
}
```

**Server-Side Validation:**

- Additional validation on backend
- S3 upload error handling
- SQS messaging error handling

---

## Review Results & Export

### Review Results Page

**Route:** `/review/results/:id`

**Features:**

- Summary score with visual indicators
- Detailed findings by category
- Recommendations list
- Workflow status tracking
- Export buttons

### Display Components

**Score Badge:**

```html
<div class="score-badge score-excellent">
  <span class="score-number">92</span>
  <span class="score-label">Excellent</span>
</div>
```

**Findings Table:**

```html
<table class="govuk-table">
  <thead>
    <tr>
      <th>Section</th>
      <th>Issue</th>
      <th>Severity</th>
      <th>Recommendation</th>
    </tr>
  </thead>
  <tbody>
    <!-- Findings data -->
  </tbody>
</table>
```

### Export Feature

**Supported Formats:**

1. **PDF Export** - Professional report format
2. **Word Export** - Editable document format

**Implementation:**

**Route:** `/review/results/:id/export`

**Query Parameters:**

- `format=pdf` or `format=word`

**Example:**

```javascript
// Export as PDF
<a href="/review/results/123/export?format=pdf"
   class="govuk-button">
  Export as PDF
</a>

// Export as Word
<a href="/review/results/123/export?format=word"
   class="govuk-button govuk-button--secondary">
  Export as Word
</a>
```

**Backend Handler:**

```javascript
export const exportResults = {
  handler: async (request, h) => {
    const { id } = request.params
    const { format } = request.query

    // Get review data
    const review = await getReviewData(id)

    if (format === 'pdf') {
      const pdf = await generatePDF(review)
      return h
        .response(pdf)
        .type('application/pdf')
        .header('Content-Disposition', `attachment; filename=review-${id}.pdf`)
    } else if (format === 'word') {
      const docx = await generateWord(review)
      return h
        .response(docx)
        .type(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        .header('Content-Disposition', `attachment; filename=review-${id}.docx`)
    }
  }
}
```

---

## Environment Configuration

### Single Configuration Approach

**We use ONE `.env.example` template** for all environments. The application auto-computes environment-specific values based on the `ENVIRONMENT` variable.

### Why This Works

1. **CDP auto-injects** `ENVIRONMENT` variable (dev, test, perf-test, prod)
2. **Config file computes** URLs and settings from ENVIRONMENT
3. **CDP manages secrets** (Redis passwords, session secrets)
4. **Most settings are static** across environments

### Configuration Per Environment

#### Local Development

```bash
# .env file
NODE_ENV=development
ENVIRONMENT=local
BACKEND_URL=http://localhost:3001
SESSION_CACHE_ENGINE=memory
LOG_LEVEL=debug
LOG_FORMAT=pino-pretty
```

**Auto-computed:**

- S3 Bucket: `dev-service-optimisation-c63f2`
- Uploader URL: Same as BACKEND_URL

#### CDP Dev Environment

**Set in CDP Portal:**

```bash
ENVIRONMENT=dev
```

**Auto-computed:**

- Backend URL: `https://content-reviewer-backend.dev.cdp-int.defra.cloud`
- S3 Bucket: `dev-service-optimisation-c63f2`
- Uploader URL: Same as backend URL
- Session Engine: redis
- Log Format: ecs

**CDP provides:**

- `SERVICE_VERSION`
- `SESSION_COOKIE_PASSWORD` (from Secrets Manager)
- `REDIS_*` configuration

#### CDP Test Environment

**Set in CDP Portal:**

```bash
ENVIRONMENT=test
```

**Auto-computed:**

- Backend URL: `https://content-reviewer-backend.test.cdp-int.defra.cloud`
- S3 Bucket: `test-service-optimisation-bucket`

#### CDP Production Environment

**Set in CDP Portal:**

```bash
ENVIRONMENT=prod
LOG_LEVEL=warn  # Less verbose for production
```

**Auto-computed:**

- Backend URL: `https://content-reviewer-backend.prod.cdp-int.defra.cloud`
- S3 Bucket: `prod-service-optimisation-bucket`

### Environment Variable Priorities

1. **CDP-Injected** (highest priority)
   - Set in CDP Portal → Environment Variables
   - Overrides all defaults

2. **CDP Secrets Manager**
   - Stored securely, injected at runtime
   - Used for sensitive values

3. **Config Auto-Computed**
   - Computed from ENVIRONMENT variable
   - Used if not explicitly set

4. **Config Defaults** (lowest priority)
   - Fallback values in config.js
   - Used for development

---

## CDP Deployment

### Prerequisites

- Access to CDP Portal
- Service created in CDP
- AWS resources provisioned (S3, SQS)
- Backend service deployed

### Step 1: Configure Environment Variables

**Login to CDP Portal:**

```
https://portal.cdp-int.defra.cloud/
```

**Navigate to Service:**

```
Services → content-reviewer-frontend → Environments → [dev/test/perf-test/prod]
```

**Set Required Variable:**

```bash
# Only this is required!
ENVIRONMENT=dev  # or test, perf-test, prod
```

**Optional Overrides:**

```bash
# Only set these if auto-computed values don't work
BACKEND_URL=https://custom-backend-url.dev.cdp-int.defra.cloud
CDP_UPLOADER_S3_BUCKET=custom-bucket-name
LOG_LEVEL=debug  # For more verbose logging
```

### Step 2: Configure Secrets

**Navigate to Secrets Manager:**

```
Services → content-reviewer-frontend → Secrets
```

**Add Secret:**

```bash
Name: SESSION_COOKIE_PASSWORD
Value: <generate-random-32-char-string>

# Generate with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Deploy Service

**Via CDP Portal:**

1. Navigate to: Services → content-reviewer-frontend
2. Click: "Deploy"
3. Select environment: dev
4. Select version: latest (or specific commit)
5. Click: "Deploy"

**Via CDP CLI:**

```bash
cdp-cli deploy \
  --service content-reviewer-frontend \
  --environment dev \
  --version latest
```

### Step 4: Verify Deployment

**Check Application Logs:**

```bash
# Via CDP Portal
Services → content-reviewer-frontend → Logs

# Look for:
Configuration Loaded:
✅ Environment: dev
✅ Backend URL: https://content-reviewer-backend.dev.cdp-int.defra.cloud
✅ S3 Bucket: dev-service-optimisation-c63f2
```

**Test Application:**

```bash
# Health check
curl https://content-reviewer-frontend.dev.cdp-int.defra.cloud/health

# Expected response:
{"status":"ok"}
```

### Deployment Checklist

**Pre-Deployment:**

- [ ] Code reviewed and approved
- [ ] Tests passing
- [ ] Dependencies updated
- [ ] Environment variables configured in CDP Portal
- [ ] Secrets added to Secrets Manager
- [ ] Backend service deployed and accessible

**Deployment:**

- [ ] Deploy to dev environment
- [ ] Verify health endpoint
- [ ] Check application logs
- [ ] Test file upload
- [ ] Test review results
- [ ] Test export functionality

**Post-Deployment:**

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify session management
- [ ] Test user workflows end-to-end
- [ ] Document any issues

### Rollback Procedure

**If deployment fails:**

1. **Via CDP Portal:**

   ```
   Services → content-reviewer-frontend → Deployments
   → Select previous working version
   → Click "Rollback"
   ```

2. **Via CDP CLI:**

   ```bash
   cdp-cli rollback \
     --service content-reviewer-frontend \
     --environment dev \
     --to-version <previous-version>
   ```

3. **Verify rollback:**
   ```bash
   curl https://content-reviewer-frontend.dev.cdp-int.defra.cloud/health
   ```

---

## Testing

### Test Structure

```
src/
└── server/
    ├── home/
    │   ├── controller.js
    │   └── controller.test.js    # Tests for home controller
    ├── about/
    │   ├── controller.js
    │   └── controller.test.js    # Tests for about controller
    └── upload/
        ├── controller.js
        └── controller.test.js    # Tests for upload controller
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- controller.test.js
```

### Test Example

**File: `src/server/home/controller.test.js`**

```javascript
import { describe, it, expect } from 'vitest'
import { homeController } from './controller.js'

describe('Home Controller', () => {
  it('should return home view', async () => {
    const mockRequest = {}
    const mockH = {
      view: (template, context) => ({ template, context })
    }

    const result = await homeController.handler(mockRequest, mockH)

    expect(result.template).toBe('home/index')
    expect(result.context.pageTitle).toBe('Content Review Tool')
  })
})
```

### Test Coverage Goals

| Type              | Target         |
| ----------------- | -------------- |
| Unit Tests        | > 80%          |
| Integration Tests | > 70%          |
| E2E Tests         | Critical paths |

### Writing Tests

**Good Test Structure:**

```javascript
describe('Feature', () => {
  describe('when condition', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = setupTestData()

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe(expectedOutput)
    })
  })
})
```

---

## Troubleshooting

### Common Issues

#### 1. Server Won't Start

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

#### 2. Backend Connection Failed

**Error:** `ECONNREFUSED connecting to backend`

**Solution:**

```bash
# Check backend is running
curl http://localhost:3001/health

# Verify BACKEND_URL in .env
grep BACKEND_URL .env

# Check logs for actual URL being used
npm start
# Look for: "Backend URL: http://localhost:3001"
```

#### 3. File Upload Fails

**Error:** `Upload failed: 400 Bad Request`

**Possible Causes:**

- File too large (>10MB)
- Unsupported file type
- Backend S3 configuration issue

**Solution:**

```bash
# Check file size
ls -lh myfile.pdf

# Verify backend S3 configuration
curl http://localhost:3001/health

# Check backend logs for S3 errors
```

#### 4. Session Not Persisting

**Error:** Session data lost on page refresh

**Solution:**

```bash
# Check session cache engine
grep SESSION_CACHE_ENGINE .env

# For local dev, use memory
SESSION_CACHE_ENGINE=memory

# For production, ensure Redis is configured
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-redis-password
```

#### 5. Static Assets Not Loading

**Error:** 404 on CSS/JS files

**Solution:**

```bash
# Rebuild frontend assets
npm run build:frontend

# Check public directory
ls -la public/

# Verify asset path in config
grep ASSET_PATH .env
```

#### 6. Environment Variables Not Loading

**Error:** Configuration shows default values

**Solution:**

```bash
# Ensure .env file exists
ls -la .env

# Check NODE_ENV
echo $NODE_ENV

# Verify dotenv is loading
# Check src/index.js for dotenv configuration
```

### Debug Mode

**Enable debug logging:**

```bash
# In .env
LOG_LEVEL=debug
LOG_FORMAT=pino-pretty

# Restart server
npm run dev
```

**Debug output will show:**

- Configuration loaded
- Routes registered
- Plugin initialization
- Request/response details
- Error stack traces

### Health Checks

**Application Health:**

```bash
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345
}
```

**Backend Health:**

```bash
curl http://localhost:3001/health
```

### Logging

**Log Locations:**

- **Development:** Console output
- **Production:** Stdout (captured by CDP)

**Log Levels:**

- `fatal` - Application crash
- `error` - Error occurred but app continues
- `warn` - Warning condition
- `info` - Normal operation
- `debug` - Detailed debugging info
- `trace` - Very detailed tracing

**View Logs:**

```bash
# Local development
npm run dev
# Logs appear in console

# CDP production
# View in CDP Portal → Services → Logs
```

---

## API Reference

### Frontend Routes

#### Homepage

```
GET /
```

**Description:** Application homepage with navigation

**Response:** HTML page with GOV.UK styling

#### About Page

```
GET /about
```

**Description:** Information about the service

**Response:** HTML page

#### Upload Page

```
GET /upload
```

**Description:** File upload form

**Response:** HTML page with drag & drop interface

#### Upload Handler

```
POST /upload
```

**Description:** Process file upload

**Request:**

```http
POST /upload
Content-Type: multipart/form-data

file: <binary-data>
```

**Response:**

```json
{
  "success": true,
  "uploadId": "abc-123-def",
  "s3Location": "s3://bucket/path/to/file",
  "message": "File uploaded successfully"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "File too large",
  "statusCode": 400
}
```

#### Review Results

```
GET /review/results/:id
```

**Description:** Display review results for uploaded document

**Parameters:**

- `id` - Upload/Review ID

**Response:** HTML page with review details

#### Export Results

```
GET /review/results/:id/export?format={pdf|word}
```

**Description:** Export review results

**Parameters:**

- `id` - Review ID
- `format` - Export format (pdf or word)

**Response:**

- **PDF:** `application/pdf` binary
- **Word:** `application/vnd.openxmlformats-officedocument.wordprocessingml.document` binary

**Headers:**

```http
Content-Disposition: attachment; filename=review-{id}.{ext}
Content-Type: application/pdf (or application/vnd.openxmlformats-...)
```

#### Health Check

```
GET /health
```

**Description:** Service health status

**Response:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345,
  "memory": {
    "used": 50000000,
    "total": 100000000
  }
}
```

### Configuration API

**Access configuration in code:**

```javascript
import { config } from './config/config.js'

// Get values
const backendUrl = config.get('backendUrl')
const s3Bucket = config.get('cdpUploader.s3Bucket')
const port = config.get('port')

// Check environment
const isProd = config.get('isProduction')
const isDev = config.get('isDevelopment')
```

### Session API

**Set session data:**

```javascript
export const handler = (request, h) => {
  request.yar.set('uploadId', '123')
  request.yar.set('userName', 'John Doe')

  return h.response('Session saved')
}
```

**Get session data:**

```javascript
export const handler = (request, h) => {
  const uploadId = request.yar.get('uploadId')
  const userName = request.yar.get('userName')

  return h.response({ uploadId, userName })
}
```

**Clear session:**

```javascript
export const handler = (request, h) => {
  request.yar.clear('uploadId')
  // Or clear all
  request.yar.reset()

  return h.response('Session cleared')
}
```

---

## Architecture

### Application Layers

```
┌─────────────────────────────────────────┐
│          Browser (Client)               │
│  - HTML/CSS (GOV.UK Design)             │
│  - JavaScript (upload-handler.js)       │
└──────────────┬──────────────────────────┘
               │ HTTP/HTTPS
┌──────────────▼──────────────────────────┐
│     Frontend Server (Hapi.js)           │
│  - Routes & Controllers                 │
│  - Nunjucks Templates                   │
│  - Session Management                   │
└──────────────┬──────────────────────────┘
               │ HTTP/HTTPS
┌──────────────▼──────────────────────────┐
│     Backend API                         │
│  - File Upload to S3                    │
│  - SQS Message Sending                  │
│  - AI Review Processing                 │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼─────┐    ┌──────▼──────┐
│    S3     │    │     SQS     │
│  Bucket   │    │    Queue    │
└───────────┘    └─────────────┘
```

### Request Flow

**File Upload Flow:**

```
User Browser
  → POST /upload (with file)
  → Frontend Server receives file
  → Forward to Backend API
  → Backend uploads to S3
  → Backend sends SQS message
  → Backend returns upload ID
  → Frontend displays confirmation
  → User redirected to results page (when ready)
```

**Review Results Flow:**

```
User Browser
  → GET /review/results/:id
  → Frontend fetches from Backend API
  → Backend retrieves from S3/Database
  → Frontend renders results page
  → User can export (PDF/Word)
```

### Technology Stack Details

**Server Framework:**

- **Hapi.js** - Web framework
  - Plugin architecture
  - Built-in validation
  - Lifecycle hooks

**Templating:**

- **Nunjucks** - Server-side templating
  - Template inheritance
  - Macros and filters
  - Context passing

**Styling:**

- **GOV.UK Frontend** - Design system
  - Components
  - Typography
  - Grid system
- **SASS** - CSS preprocessor

**Client-Side:**

- **Vanilla JavaScript** - No framework
  - Upload handling
  - Form validation
  - Progressive enhancement

**Session Management:**

- **Yar** (Hapi plugin) - Session handling
- **Redis** or **Memory** - Session storage

**Build Tools:**

- **Webpack** - Frontend bundling
- **Babel** - JavaScript transpiling
- **Nodemon** - Development auto-reload

**Testing:**

- **Vitest** - Unit testing
- **ESLint** - Code linting
- **Prettier** - Code formatting

### Security

**Implemented Security Measures:**

1. **Content Security Policy (CSP)**
   - Via `blankie` plugin
   - Prevents XSS attacks

2. **HTTPS Enforcement**
   - In production environments
   - Via `hapi-secure-context`

3. **Session Security**
   - HTTP-only cookies
   - Secure flag in production
   - Encrypted session data

4. **Input Validation**
   - File type validation
   - File size limits
   - Joi schema validation

5. **CSRF Protection**
   - Via `crumb` plugin
   - Token-based validation

6. **Security Headers**
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection

### Performance Optimizations

1. **Static Asset Caching**
   - 1 week cache for CSS/JS
   - Versioned filenames

2. **Session Caching**
   - Redis for distributed sessions
   - 4-hour TTL

3. **Compression**
   - Gzip compression enabled
   - Via Hapi compression

4. **Lazy Loading**
   - Routes loaded on demand
   - Reduced initial bundle size

### Monitoring & Observability

**Metrics:**

- Request rate
- Response times
- Error rates
- Memory usage
- CPU usage

**Logging:**

- Structured logging (ECS format)
- Request tracing
- Error tracking

**Health Checks:**

- `/health` endpoint
- Uptime monitoring
- Dependency checks

---

## Additional Resources

### Documentation

- **GOV.UK Design System:** https://design-system.service.gov.uk/
- **Hapi.js Framework:** https://hapi.dev/
- **Nunjucks Templating:** https://mozilla.github.io/nunjucks/
- **CDP Platform:** https://docs.cdp-int.defra.cloud/

### Support

- **Team Contact:** [Your team email]
- **CDP Support:** cdp-support@defra.gov.uk
- **Issue Tracker:** [GitHub Issues URL]

### Contributing

See project README for contribution guidelines.

---

## Changelog

### Version 1.0.0 (January 2026)

**Features:**

- ✅ File upload with drag & drop
- ✅ Review results display
- ✅ Export to PDF/Word
- ✅ GOV.UK Design System compliance
- ✅ Smart environment configuration
- ✅ CDP deployment ready

**Configuration:**

- ✅ Single `.env.example` template
- ✅ Auto-computed environment values
- ✅ Simplified deployment process

**Documentation:**

- ✅ Consolidated user guide
- ✅ Deployment guide
- ✅ Troubleshooting guide

---

## License

OGL-UK-3.0

Copyright (c) 2026 Department for Environment, Food & Rural Affairs (Defra)

---

**Document Version:** 1.0  
**Last Updated:** January 8, 2026  
**Maintained By:** Content Reviewer Frontend Team
