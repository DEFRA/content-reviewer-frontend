# Content Reviewer Frontend - Complete Documentation

**Last Updated**: December 29, 2025  
**Status**: ✅ Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Features](#features)
4. [Architecture](#architecture)
5. [File Upload System](#file-upload-system)
6. [Chat Interface](#chat-interface)
7. [Configuration](#configuration)
8. [Development](#development)
9. [Deployment](#deployment)
10. [API Reference](#api-reference)
11. [Troubleshooting](#troubleshooting)
12. [Security](#security)

---

## Overview

A GOV.UK Design System compliant web application for reviewing content using AI. The application provides:

- **AI-powered chat interface** for content review and assistance
- **Document upload capability** for PDF and Word documents
- **Integrated workflow** combining chat and file upload in a single interface
- **GOV.UK Design System** compliance for accessibility and usability
- **Secure file storage** using AWS S3
- **Session management** with Redis caching

### Technology Stack

- **Frontend Framework**: Node.js `>= v22`, Hapi.js
- **View Engine**: Nunjucks
- **Styling**: SCSS, GOV.UK Design System
- **Build Tool**: Webpack
- **Caching**: Redis (production), CatboxMemory (development)
- **File Storage**: AWS S3
- **File Upload**: Multer, AWS SDK v3

---

## Quick Start

### Prerequisites

- Node.js `>= v22` and npm `>= v9`
- AWS credentials configured (for S3 access)
- Redis (optional, for production)

### Installation

```powershell
# Clone and navigate to project
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-frontend"

# Install dependencies
npm install

# Start development server
npm run dev
```

### Access the Application

Open your browser to:

```
http://localhost:3000
```

### Running Backend Services

**Backend API** (required for chat and upload):

```powershell
cd "../content-reviewer-backend"
npm start
# Runs on http://localhost:3001
```

---

## Features

### ✅ Core Features

| Feature                | Description                              | Status      |
| ---------------------- | ---------------------------------------- | ----------- |
| **Chat Interface**     | Real-time AI-powered content review chat | ✅ Complete |
| **Document Upload**    | Upload PDF and Word documents            | ✅ Complete |
| **File Validation**    | Type and size validation (10MB max)      | ✅ Complete |
| **S3 Storage**         | Secure cloud storage integration         | ✅ Complete |
| **Session Management** | Redis-backed session caching             | ✅ Complete |
| **Notifications**      | Success/error flash messages             | ✅ Complete |
| **Responsive Design**  | Mobile-friendly interface                | ✅ Complete |
| **Accessibility**      | WCAG AA compliant                        | ✅ Complete |
| **CSP Compliance**     | Content Security Policy enforcement      | ✅ Complete |

### User Interface Features

- **Integrated Experience**: Chat and upload on single page
- **Collapsible Upload Section**: Expandable details component
- **Visual Feedback**: Progress indicators and status messages
- **Conversation History**: Sidebar with chat history
- **GOV.UK Components**: Notification banners, buttons, forms
- **Error Handling**: User-friendly error messages

---

## Architecture

### Application Structure

```
content-reviewer-frontend/
├── src/
│   ├── client/                    # Frontend assets
│   │   ├── javascripts/
│   │   │   ├── application.js     # Main JS entry point
│   │   │   └── upload-handler.js  # Upload functionality
│   │   └── stylesheets/
│   │       ├── application.scss   # Main styles
│   │       └── components/
│   │           ├── _chat.scss     # Chat interface styles
│   │           └── _upload.scss   # Upload component styles
│   ├── config/                    # Configuration
│   │   └── config.js              # App configuration
│   └── server/                    # Server-side code
│       ├── router.js              # Route definitions
│       ├── server.js              # Server setup
│       ├── home/                  # Home page module
│       │   ├── controller.js
│       │   ├── index.js
│       │   └── index.njk
│       ├── upload/                # Upload module
│       │   ├── controller.js
│       │   ├── index.js
│       │   └── upload-form.njk
│       └── common/
│           └── helpers/
│               └── backend-upload-client.js
├── package.json
├── webpack.config.js
└── README.md
```

### Request Flow

```
User Request
    ↓
Hapi.js Server (Port 3000)
    ↓
Router → Route Handler
    ↓
Controller → Business Logic
    ↓
Backend API (Port 3001)
    ↓
AWS S3 / Redis / Database
    ↓
Response → View (Nunjucks)
    ↓
User Interface
```

---

## File Upload System

### Overview

The file upload system allows users to upload PDF and Word documents directly from the chat interface. Files are validated, uploaded to AWS S3, and metadata is stored for tracking.

### Upload Flow

```
1. User on home page (chat interface)
   ↓
2. Expands "Upload a document for review" section
   ↓
3. Clicks "Choose and Upload Document"
   ↓
4. Redirects to /upload/form
   ↓
5. User selects file from file picker
   ↓
6. JavaScript uploads file to backend API
   ↓
7. Backend validates file (type, size)
   ↓
8. Backend uploads to S3
   ↓
9. Success response with file details
   ↓
10. Stores success message in sessionStorage
   ↓
11. Redirects back to home page
   ↓
12. Success notification appears
```

### Supported File Types

- **PDF**: `.pdf` (application/pdf)
- **Word 2007+**: `.docx` (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- **Word 97-2003**: `.doc` (application/msword)

**Maximum file size**: 10MB

### Upload Validation

#### Client-Side Validation

- File type check (PDF, DOC, DOCX)
- File size pre-check (10MB limit)
- User-friendly error messages

#### Server-Side Validation

- MIME type detection
- File size enforcement
- Content type verification
- Error logging and reporting

### S3 Storage Structure

Files are stored in the following structure:

```
s3://dev-service-optimisation-c63f2/
  └── content-uploads/
      └── {uploadId}/
          └── {filename}
```

Example:

```
s3://dev-service-optimisation-c63f2/content-uploads/abc123-def456/document.pdf
```

### Upload Response Format

**Success Response:**

```json
{
  "success": true,
  "uploadId": "abc123-def456",
  "filename": "document.pdf",
  "size": 204800,
  "contentType": "application/pdf",
  "s3Bucket": "dev-service-optimisation-c63f2",
  "s3Key": "content-uploads/abc123-def456/document.pdf",
  "s3Location": "s3://dev-service-optimisation-c63f2/content-uploads/abc123-def456/document.pdf"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "File too large. Maximum size is 10MB"
}
```

### CSP-Compliant Implementation

All upload functionality is implemented with Content Security Policy compliance:

- **No inline scripts**: All JavaScript in external files
- **No inline styles**: All styling via CSS classes
- **Data attributes**: Progress updates use `data-progress` attributes
- **CSS-based animations**: Progress bar updates via CSS classes

#### Progress Bar Implementation

**HTML:**

```html
<div class="upload-progress-container">
  <div id="progressBar" class="upload-progress-bar" data-progress="0"></div>
</div>
```

**CSS:**

```scss
.upload-progress-bar {
  &[data-progress='0'] {
    width: 0%;
  }
  &[data-progress='30'] {
    width: 30%;
  }
  &[data-progress='70'] {
    width: 70%;
  }
  &[data-progress='100'] {
    width: 100%;
  }
}
```

**JavaScript:**

```javascript
function showProgress(statusText, percentage) {
  const roundedPercentage = Math.round(percentage / 10) * 10
  progressBar.setAttribute('data-progress', roundedPercentage.toString())
}
```

---

## Chat Interface

### Features

- **Real-time messaging**: Instant communication with AI assistant
- **Conversation history**: Sidebar showing recent conversations
- **Message formatting**: Markdown support for rich text
- **User/Bot distinction**: Clear visual separation
- **New chat**: Start fresh conversations

### Chat Flow

```
1. User types message in text area
   ↓
2. Clicks "Send" button
   ↓
3. Frontend sends to backend API
   ↓
4. Backend processes with AI
   ↓
5. Response appears in chat
   ↓
6. Conversation saved to history
```

### Integration with Upload

After uploading a document:

1. Success notification appears
2. File details displayed (name, size, ID, location)
3. User can immediately start chatting about the document
4. Upload and chat history maintained in session

---

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Backend API
BACKEND_URL=http://localhost:3001

# AWS Configuration
AWS_REGION=eu-west-2
UPLOAD_S3_BUCKET=dev-service-optimisation-c63f2
UPLOAD_S3_PATH=content-uploads

# Upload Limits
UPLOAD_MAX_FILE_SIZE=10485760  # 10MB in bytes
UPLOAD_ALLOWED_MIME_TYPES=application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# Session/Caching
SESSION_CACHE_ENGINE=memory  # Use 'redis' in production
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

### AWS Credentials

Configure AWS credentials using one of these methods:

**Option 1: AWS CLI**

```bash
aws configure
# Enter AWS Access Key ID
# Enter AWS Secret Access Key
# Default region: eu-west-2
```

**Option 2: Environment Variables**

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=eu-west-2
```

**Option 3: IAM Role** (recommended for production)

- Use IAM roles on EC2/ECS instances

### S3 Bucket Setup

Ensure your S3 bucket has:

- PutObject permissions for the backend service
- Proper CORS configuration
- Encryption enabled (recommended)
- Versioning enabled (optional)

---

## Development

### Local Development Setup

```powershell
# Install dependencies
npm install

# Start development server with hot reload
npm run dev
```

This starts:

- Frontend server on `http://localhost:3000`
- Webpack watch mode for auto-rebuild
- Nodemon for server auto-restart

### Building Assets

```powershell
# Build frontend assets for production
npm run build:frontend

# Watch mode (auto-rebuild on changes)
npm run frontend:watch
```

### Running Tests

```powershell
# Run all tests with coverage
npm test

# Watch mode for development
npm run test:watch
```

### Code Quality

```powershell
# Lint JavaScript
npm run lint:js

# Lint SCSS
npm run lint:scss

# Auto-fix linting issues
npm run lint:js:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Security audit
npm run security-audit
```

### NPM Scripts

All available scripts:

| Script                   | Description               |
| ------------------------ | ------------------------- |
| `npm run dev`            | Start development server  |
| `npm start`              | Start production server   |
| `npm test`               | Run tests with coverage   |
| `npm run build:frontend` | Build production assets   |
| `npm run frontend:watch` | Watch and rebuild assets  |
| `npm run server:watch`   | Server with auto-restart  |
| `npm run lint`           | Lint JS and SCSS          |
| `npm run format`         | Format code               |
| `npm run security-audit` | Check for vulnerabilities |

### Docker Development

```bash
# Build development image
docker build --target development --tag content-reviewer-frontend:dev .

# Run container
docker run -p 3000:3000 content-reviewer-frontend:dev

# Docker Compose (all services)
docker compose up --build -d
```

---

## Deployment

### Production Build

```powershell
# Install production dependencies only
npm ci --production

# Build frontend assets
npm run build:frontend

# Start production server
npm start
```

### Production Docker Image

```bash
# Build production image
docker build --tag content-reviewer-frontend:latest .

# Run production container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_CACHE_ENGINE=redis \
  -e REDIS_HOST=redis.example.com \
  content-reviewer-frontend:latest
```

### Environment Configuration

**Production checklist:**

- ✅ Set `NODE_ENV=production`
- ✅ Use Redis for session caching (`SESSION_CACHE_ENGINE=redis`)
- ✅ Configure AWS credentials via IAM role
- ✅ Set proper CORS_ORIGIN
- ✅ Enable HTTPS
- ✅ Set secure cookie flags
- ✅ Configure logging
- ✅ Set up monitoring

---

## API Reference

### Frontend Routes

| Method | Route              | Description                    |
| ------ | ------------------ | ------------------------------ |
| GET    | `/`                | Home page with chat and upload |
| GET    | `/upload/form`     | Upload form page               |
| POST   | `/upload/initiate` | Start upload process           |
| GET    | `/about`           | About page                     |
| GET    | `/health`          | Health check endpoint          |

### Backend API Endpoints

**Upload Endpoint:**

```
POST http://localhost:3001/api/upload
Content-Type: multipart/form-data

Body:
- file: (binary file data)
```

**Health Check:**

```
GET http://localhost:3001/api/upload/health
```

**Chat Endpoint:**

```
POST http://localhost:3001/api/chat
Content-Type: application/json

Body:
{
  "message": "Review this content...",
  "conversationId": "optional-conversation-id"
}
```

---

## Troubleshooting

### Upload Not Working

**Symptom**: Upload button doesn't work or shows errors

**Solutions**:

1. Check backend is running on port 3001
2. Verify AWS credentials are configured
3. Check S3 bucket exists and is accessible
4. Review browser console for JavaScript errors
5. Check file meets requirements (PDF/Word, under 10MB)

### CSP Violations

**Symptom**: Console shows Content Security Policy errors

**Solutions**:

1. Ensure no inline scripts in templates
2. Verify all JavaScript is in external files
3. Check styles are in CSS files, not inline
4. Rebuild frontend assets: `npm run build:frontend`

### Chat Not Working

**Symptom**: Messages don't send or receive responses

**Solutions**:

1. Verify backend API is running on port 3001
2. Check browser console for fetch errors
3. Verify CORS configuration allows localhost:3000
4. Check network tab for failed requests

### Success Message Not Showing

**Symptom**: Upload succeeds but no notification appears

**Solutions**:

1. Check sessionStorage in browser DevTools
2. Verify `upload-handler.js` is loaded
3. Check console for JavaScript errors
4. Ensure webpack build completed successfully

### Styling Issues

**Symptom**: Page looks broken or unstyled

**Solutions**:

1. Run `npm run build:frontend` to rebuild CSS
2. Hard refresh browser (Ctrl+Shift+R)
3. Check webpack compilation logs for errors
4. Verify SCSS files have no syntax errors

### Redis Connection Errors

**Symptom**: Session errors in production

**Solutions**:

1. Set `SESSION_CACHE_ENGINE=memory` for local dev
2. Verify Redis is running and accessible
3. Check REDIS_HOST and REDIS_PORT settings
4. Review Redis logs for connection issues

---

## Security

### Content Security Policy

Strict CSP is enforced to prevent XSS attacks:

```
script-src 'self' 'nonce-{random}';
style-src 'self' 'nonce-{random}';
```

All JavaScript and CSS must be:

- In external files (no inline)
- Loaded with proper nonce values
- Free from `eval()` or dynamic code execution

### File Upload Security

- ✅ File type validation (MIME type detection)
- ✅ File size limits (10MB max)
- ✅ Server-side validation (don't trust client)
- ✅ Secure S3 storage with encryption
- ✅ Unique upload IDs prevent collisions
- ✅ No executable file types allowed

### Session Security

- ✅ Session data stored in Redis (production)
- ✅ Secure cookie flags in production
- ✅ Session expiration
- ✅ CSRF protection (via session)

### CORS Configuration

```javascript
{
  origin: 'http://localhost:3000',
  credentials: true
}
```

In production, set to your actual domain.

### Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for configuration
3. **Enable HTTPS** in production
4. **Regular security audits**: `npm run security-audit`
5. **Keep dependencies updated**: Use Dependabot
6. **Input validation** on all user inputs
7. **Output encoding** to prevent XSS
8. **Rate limiting** on API endpoints (recommended)

---

## Additional Resources

### Documentation Files (Archived)

The following documentation files have been consolidated into this document:

- `UPLOAD_FEATURE_SUMMARY.md` - Initial upload feature documentation
- `QUICK_START.md` - Quick start guide
- `INTEGRATED_UPLOAD_CHAT.md` - Upload/chat integration details
- `BACKEND_UPLOAD_INTEGRATION.md` - Backend integration specifics

### External Documentation

- [GOV.UK Design System](https://design-system.service.gov.uk/)
- [Hapi.js Documentation](https://hapi.dev/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Nunjucks Template Engine](https://mozilla.github.io/nunjucks/)

---

## Support & Contribution

### Reporting Issues

Found a bug or have a suggestion? Please:

1. Check existing issues
2. Create a new issue with detailed description
3. Include steps to reproduce
4. Provide environment details

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and tests
5. Submit pull request

---

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the Licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

---

**End of Documentation**

For the most up-to-date information, please refer to the source code and inline comments.
