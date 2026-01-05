# Content Reviewer Frontend - User Guide

**Last Updated:** January 5, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Features](#features)
4. [User Interface Guide](#user-interface-guide)
5. [Document Upload](#document-upload)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)
8. [Development Guide](#development-guide)
9. [API Integration](#api-integration)
10. [Security & Best Practices](#security--best-practices)

---

## Overview

The Content Reviewer Frontend is a GOV.UK Design System compliant web application that provides a user-friendly interface for uploading and managing documents for AI-powered content review.

### Key Features

- ✅ **GOV.UK Design System** - Accessible, responsive UI following government standards
- ✅ **Document Upload** - Support for PDF and Word documents (up to 10MB)
- ✅ **Real-time Feedback** - Upload progress tracking and status updates
- ✅ **Session Management** - Secure session handling with Redis/Memory cache
- ✅ **CDP Uploader Integration** - Seamless integration with CDP file upload service
- ✅ **Health Monitoring** - Built-in health check endpoints
- ✅ **Responsive Design** - Mobile-first, accessible interface

### System Requirements

- **Node.js**: >= v24
- **npm**: >= v9
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Redis** (Production): For session caching

---

## Getting Started

### Installation

1. **Clone the repository**

   ```bash
   cd content-reviewer-frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file or set environment variables:

   ```bash
   PORT=3000
   HOST=0.0.0.0
   NODE_ENV=development

   # CDP Uploader Configuration
   CDP_UPLOADER_URL=http://localhost:7337
   CDP_UPLOADER_S3_BUCKET=my-bucket
   CDP_UPLOADER_S3_PATH=content-uploads

   # Session Configuration
   SESSION_CACHE_ENGINE=memory  # or 'redis' for production
   SESSION_COOKIE_PASSWORD=your-secret-password-at-least-32-characters

   # Redis (if using Redis cache)
   REDIS_HOST=127.0.0.1
   REDIS_USERNAME=
   REDIS_PASSWORD=
   ```

4. **Build frontend assets**

   ```bash
   npm run build:frontend
   ```

5. **Start the application**

   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

### Quick Commands

```bash
# Development with watch mode
npm run dev

# Development with debug mode
npm run dev:debug

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Format code
npm run format

# Security audit
npm run security-audit
```

---

## Features

### 1. Home Page

The home page serves as the main entry point to the application.

**Location:** `/`

**Features:**

- Welcome message
- Navigation to upload functionality
- Upload status notifications
- Error and success messages

### 2. Document Upload

Upload PDF or Word documents for content review.

**Location:** `/upload`

**Supported File Types:**

- PDF (`.pdf`)
- Microsoft Word (`.doc`, `.docx`)

**File Size Limit:** 10MB

**Features:**

- Drag and drop support
- File validation (type and size)
- Upload progress tracking
- Real-time status updates
- Error handling with user-friendly messages

### 3. About Page

Information about the application and team.

**Location:** `/about`

### 4. Health Check

System health monitoring endpoint.

**Location:** `/health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-05T10:30:00.000Z"
}
```

---

## User Interface Guide

### Navigation

The application uses GOV.UK Design System navigation patterns:

- **Header:** Service name and navigation links
- **Footer:** Standard GOV.UK footer with links
- **Breadcrumbs:** Context-aware navigation trail

### Accessibility

The frontend is built with accessibility in mind:

- **WCAG 2.1 AA Compliant**
- **Keyboard Navigation:** Full support for keyboard-only users
- **Screen Reader Support:** ARIA labels and semantic HTML
- **Color Contrast:** Meets accessibility standards
- **Focus Management:** Clear focus indicators

### Responsive Design

The application is mobile-first and fully responsive:

- **Mobile:** Optimized for small screens
- **Tablet:** Adapted layout for medium screens
- **Desktop:** Full-featured experience

---

## Document Upload

### Upload Process

1. **Navigate to Upload Page**
   - Click "Upload" in the navigation menu
   - Or go directly to `/upload`

2. **Select a File**
   - Click "Choose file" button
   - Or drag and drop a file onto the upload area

3. **Validate File**
   - File type is automatically validated
   - File size is checked (must be ≤ 10MB)
   - Error messages display if validation fails

4. **Upload File**
   - Click "Upload" button
   - Progress bar shows upload status
   - You'll be redirected to the CDP Uploader service

5. **Status Polling**
   - After upload, the system polls for status
   - You'll be redirected back to the application when complete
   - Success or error messages are displayed

### Upload States

| State             | Description                          | User Action             |
| ----------------- | ------------------------------------ | ----------------------- |
| **Ready**         | No file selected                     | Select a file           |
| **File Selected** | File ready to upload                 | Click "Upload" button   |
| **Validating**    | Checking file type and size          | Wait                    |
| **Uploading**     | File being uploaded                  | Wait (progress shown)   |
| **Processing**    | File being processed by CDP Uploader | Wait                    |
| **Complete**      | Upload successful                    | View success message    |
| **Error**         | Upload failed                        | Review error, try again |

### Error Messages

Common upload errors and solutions:

| Error                  | Cause                   | Solution                           |
| ---------------------- | ----------------------- | ---------------------------------- |
| "Please select a file" | No file chosen          | Select a file before uploading     |
| "File too large"       | File exceeds 10MB       | Reduce file size or split document |
| "Invalid file type"    | Unsupported format      | Use PDF, DOC, or DOCX format       |
| "Upload failed"        | Network or server error | Check connection and try again     |
| "Session expired"      | Session timeout         | Refresh page and try again         |

### Upload Limitations

- **Maximum File Size:** 10MB (10,485,760 bytes)
- **Allowed Types:** PDF, DOC, DOCX
- **Concurrent Uploads:** One upload per session
- **Session Duration:** 4 hours (default)

---

## Configuration

### Environment Variables

#### Server Configuration

| Variable   | Description         | Default       | Required |
| ---------- | ------------------- | ------------- | -------- |
| `HOST`     | Server host address | `0.0.0.0`     | No       |
| `PORT`     | Server port         | `3000`        | No       |
| `NODE_ENV` | Environment mode    | `development` | No       |

#### CDP Uploader Configuration

| Variable                     | Description              | Default                 | Required |
| ---------------------------- | ------------------------ | ----------------------- | -------- |
| `CDP_UPLOADER_URL`           | CDP Uploader service URL | `http://localhost:7337` | Yes      |
| `CDP_UPLOADER_S3_BUCKET`     | S3 bucket name           | `my-bucket`             | Yes      |
| `CDP_UPLOADER_S3_PATH`       | S3 path prefix           | `content-uploads`       | No       |
| `CDP_UPLOADER_MAX_FILE_SIZE` | Max file size in bytes   | `10000000`              | No       |
| `CDP_UPLOADER_MIME_TYPES`    | Allowed MIME types       | See below               | No       |

**Default MIME Types:**

```javascript
;[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
```

#### Session Configuration

| Variable                  | Description                         | Default                        | Required |
| ------------------------- | ----------------------------------- | ------------------------------ | -------- |
| `SESSION_CACHE_ENGINE`    | Cache backend (`memory` or `redis`) | `memory` (dev), `redis` (prod) | No       |
| `SESSION_CACHE_NAME`      | Session cache name                  | `session`                      | No       |
| `SESSION_CACHE_TTL`       | Session TTL in ms                   | `14400000` (4 hours)           | No       |
| `SESSION_COOKIE_PASSWORD` | Cookie encryption password          | -                              | **Yes**  |
| `SESSION_COOKIE_TTL`      | Cookie TTL in ms                    | `14400000` (4 hours)           | No       |
| `SESSION_COOKIE_SECURE`   | Use secure cookies                  | `true` (prod)                  | No       |

#### Redis Configuration (Production)

| Variable                    | Description           | Default                      | Required             |
| --------------------------- | --------------------- | ---------------------------- | -------------------- |
| `REDIS_HOST`                | Redis server host     | `127.0.0.1`                  | Yes (if using Redis) |
| `REDIS_USERNAME`            | Redis username        | ``                           | No                   |
| `REDIS_PASSWORD`            | Redis password        | ``                           | No                   |
| `REDIS_KEY_PREFIX`          | Redis key prefix      | `content-reviewer-frontend:` | No                   |
| `REDIS_TLS`                 | Use TLS for Redis     | `true` (prod)                | No                   |
| `USE_SINGLE_INSTANCE_CACHE` | Single Redis instance | `true` (dev)                 | No                   |

#### Logging Configuration

| Variable      | Description    | Default                           | Required |
| ------------- | -------------- | --------------------------------- | -------- |
| `LOG_ENABLED` | Enable logging | `true`                            | No       |
| `LOG_LEVEL`   | Log level      | `info`                            | No       |
| `LOG_FORMAT`  | Log format     | `pino-pretty` (dev), `ecs` (prod) | No       |

#### Security Configuration

| Variable                | Description              | Default       | Required |
| ----------------------- | ------------------------ | ------------- | -------- |
| `ENABLE_SECURE_CONTEXT` | Enable security headers  | `true` (prod) | No       |
| `ENABLE_METRICS`        | Enable metrics reporting | `true` (prod) | No       |
| `HTTP_PROXY`            | HTTP proxy URL           | `null`        | No       |

### Configuration Files

#### `package.json`

Defines project metadata, dependencies, and npm scripts.

**Key Scripts:**

```json
{
  "dev": "Development mode with watch",
  "start": "Production mode",
  "test": "Run tests with coverage",
  "lint": "Lint JavaScript and SCSS",
  "format": "Format code with Prettier",
  "build:frontend": "Build frontend assets"
}
```

#### `webpack.config.js`

Webpack configuration for building frontend assets:

- JavaScript bundling
- SCSS compilation
- Asset copying
- Source maps

#### `nodemon.json`

Nodemon configuration for development auto-reload.

#### `.nvmrc`

Specifies Node.js version for the project.

---

## Troubleshooting

### Common Issues

#### 1. Upload Fails

**Symptoms:** Upload button doesn't work or shows error

**Solutions:**

- Check file size (must be ≤ 10MB)
- Verify file type (PDF, DOC, DOCX only)
- Check network connection
- Verify CDP Uploader service is running
- Check browser console for errors

#### 2. Page Not Loading

**Symptoms:** Application doesn't start or shows error

**Solutions:**

```bash
# Check if port is already in use
netstat -ano | findstr :3000

# Kill the process using the port (Windows)
taskkill /PID <process_id> /F

# Verify environment variables
echo %NODE_ENV%
echo %PORT%

# Restart the application
npm run dev
```

#### 3. Session Expired

**Symptoms:** "Session expired" message or unexpected logout

**Solutions:**

- Increase session TTL in configuration
- Check Redis connection (if using Redis)
- Verify session cookie password is set
- Clear browser cookies

#### 4. Static Assets Not Loading

**Symptoms:** Missing styles or JavaScript

**Solutions:**

```bash
# Rebuild frontend assets
npm run build:frontend

# Check public directory exists
ls -la public/

# Verify asset path configuration
echo %ASSET_PATH%
```

#### 5. Redis Connection Error

**Symptoms:** "Redis connection failed" error

**Solutions:**

- Verify Redis is running: `redis-cli ping`
- Check Redis host and port configuration
- Verify Redis credentials
- Switch to memory cache for development:
  ```bash
  export SESSION_CACHE_ENGINE=memory
  ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Development with debug
npm run dev:debug

# Set log level to debug
export LOG_LEVEL=debug
npm run dev
```

### Log Files

Logs are output to console by default. In production, logs use ECS format for structured logging.

**Log Levels:**

- `fatal` - Critical errors
- `error` - Errors
- `warn` - Warnings
- `info` - Informational (default)
- `debug` - Debug information
- `trace` - Detailed trace

---

## Development Guide

### Project Structure

```
content-reviewer-frontend/
├── src/
│   ├── index.js              # Application entry point
│   ├── config/
│   │   ├── config.js         # Configuration schema
│   │   └── nunjucks/         # Template configuration
│   ├── server/
│   │   ├── server.js         # Hapi server setup
│   │   ├── router.js         # Route registration
│   │   ├── home/             # Home page module
│   │   ├── about/            # About page module
│   │   ├── upload/           # Upload module
│   │   ├── health/           # Health check module
│   │   └── common/           # Shared helpers
│   └── client/
│       ├── javascripts/      # Client-side JavaScript
│       │   ├── application.js
│       │   └── upload-handler.js
│       └── stylesheets/      # SCSS styles
│           └── application.scss
├── public/                   # Built assets (generated)
├── webpack.config.js         # Webpack configuration
├── package.json              # Project metadata
└── README.md                 # Technical documentation
```

### Adding New Pages

1. **Create page module directory**

   ```bash
   mkdir -p src/server/my-page
   ```

2. **Create controller**

   ```javascript
   // src/server/my-page/controller.js
   export const myPageController = {
     handler(request, h) {
       return h.view('my-page/index', {
         pageTitle: 'My Page',
         heading: 'Welcome'
       })
     }
   }
   ```

3. **Create route**

   ```javascript
   // src/server/my-page/index.js
   import { myPageController } from './controller.js'

   export const myPage = {
     plugin: {
       name: 'my-page',
       register(server) {
         server.route({
           method: 'GET',
           path: '/my-page',
           ...myPageController
         })
       }
     }
   }
   ```

4. **Create template**

   ```njk
   {# src/server/my-page/index.njk #}
   {% extends "common/templates/page.njk" %}

   {% block content %}
     <h1 class="govuk-heading-xl">{{ heading }}</h1>
     <p class="govuk-body">Content here</p>
   {% endblock %}
   ```

5. **Register route**

   ```javascript
   // src/server/router.js
   import { myPage } from './my-page/index.js'

   await server.register([home, about, upload, myPage])
   ```

### Styling Guidelines

Use GOV.UK Design System components:

```scss
// Import GOV.UK styles
@import 'govuk-frontend/dist/govuk/all';

// Custom styles
.my-component {
  @include govuk-font(19);
  margin-bottom: govuk-spacing(4);
}
```

### Testing

#### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run with coverage
npm run test
```

#### Example Test

```javascript
// src/server/upload/controller.test.js
import { describe, it, expect } from 'vitest'
import { uploadController } from './controller.js'

describe('Upload Controller', () => {
  it('should show upload form', async () => {
    const request = {}
    const h = {
      view: (template, context) => ({ template, context })
    }

    const result = await uploadController.showUploadForm(request, h)
    expect(result.template).toBe('upload/index')
  })
})
```

### Linting

```bash
# Lint JavaScript
npm run lint:js

# Lint SCSS
npm run lint:scss

# Fix linting issues
npm run lint:js:fix
```

### Code Formatting

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

---

## API Integration

### CDP Uploader Integration

The frontend integrates with the CDP Uploader service for file uploads.

#### Upload Flow

1. **Initiate Upload**

   ```javascript
   POST / upload / initiate
   ```

   Returns upload session with redirect URL.

2. **CDP Uploader Redirect**
   User is redirected to CDP Uploader for file selection and upload.

3. **Status Polling**

   ```javascript
   GET / upload / status - poller
   ```

   Polls upload status and displays progress.

4. **Callback**

   ```javascript
   GET /upload/callback?uploadId={id}&status={status}
   ```

   Receives callback from CDP Uploader with results.

#### CDP Uploader Client

```javascript
// src/server/common/helpers/cdp-uploader-client.js

/**
 * Initiate upload session
 */
export async function initiateUpload(options) {
  const response = await fetch(`${cdpUploaderUrl}/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redirect: options.redirect,
      callback: options.callback,
      metadata: options.metadata
    })
  })

  return await response.json()
}

/**
 * Get upload status
 */
export async function getUploadStatus(uploadId) {
  const response = await fetch(`${cdpUploaderUrl}/status/${uploadId}`)
  return await response.json()
}
```

### Session Management

The frontend uses Hapi's Yar plugin for session management.

#### Session Methods

```javascript
// Set session value
request.yar.set('key', 'value')

// Get session value
const value = request.yar.get('key')

// Flash messages (one-time messages)
request.yar.flash('success', 'Upload complete!')
const messages = request.yar.flash('success')

// Clear session
request.yar.reset()
```

---

## Security & Best Practices

### Security Features

1. **Content Security Policy (CSP)**
   - Configured via `blankie` plugin
   - Restricts resource loading

2. **Secure Cookies**
   - HttpOnly, Secure flags in production
   - Encrypted session data

3. **HTTP Headers**
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security (HSTS)

4. **Input Validation**
   - File type validation
   - File size validation
   - Form input sanitization

5. **Session Security**
   - Session timeout (4 hours)
   - Secure session storage
   - CSRF protection

### Best Practices

#### Environment Variables

- Never commit sensitive data to version control
- Use `.env` files for local development
- Use secrets management in production

#### Error Handling

```javascript
// Good: User-friendly error messages
return h.view('upload/index', {
  errorMessage: 'Upload failed. Please try again.'
})

// Bad: Exposing internal errors
return h.view('upload/index', {
  errorMessage: error.stack
})
```

#### Logging

```javascript
// Good: Structured logging
request.logger.info({ uploadId, userId }, 'Upload started')

// Bad: Unstructured logging
console.log('Upload started for user:', userId)
```

#### Performance

- Use Redis for session caching in production
- Enable static asset caching
- Minimize JavaScript bundle size
- Optimize images and assets

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure Redis for session caching
- [ ] Set strong `SESSION_COOKIE_PASSWORD`
- [ ] Enable secure cookies (`SESSION_COOKIE_SECURE=true`)
- [ ] Configure CDP Uploader URL
- [ ] Set up monitoring and logging
- [ ] Run security audit: `npm run security-audit`
- [ ] Run tests: `npm test`
- [ ] Build frontend assets: `npm run build:frontend`

### Environment Variables (Production)

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CDP Uploader
CDP_UPLOADER_URL=https://uploader.example.com
CDP_UPLOADER_S3_BUCKET=production-bucket
CDP_UPLOADER_S3_PATH=content-uploads

# Session
SESSION_CACHE_ENGINE=redis
SESSION_COOKIE_PASSWORD=<strong-password-at-least-32-chars>
SESSION_COOKIE_SECURE=true

# Redis
REDIS_HOST=redis.example.com
REDIS_USERNAME=username
REDIS_PASSWORD=<secure-password>
REDIS_TLS=true

# Security
ENABLE_SECURE_CONTEXT=true
ENABLE_METRICS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=ecs
```

### Docker Deployment

```bash
# Build production image
docker build -t content-reviewer-frontend:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_COOKIE_PASSWORD=<password> \
  -e CDP_UPLOADER_URL=<url> \
  content-reviewer-frontend:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      SESSION_CACHE_ENGINE: redis
      REDIS_HOST: redis
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

### Health Monitoring

Monitor the `/health` endpoint:

```bash
# Health check
curl http://localhost:3000/health

# Expected response
{"status":"ok","timestamp":"2026-01-05T10:30:00.000Z"}
```

### Metrics

Metrics are enabled in production via `ENABLE_METRICS=true`. Metrics include:

- Request duration
- Response status codes
- Upload success/failure rates
- Session creation/expiry
- Cache hit/miss rates

---

## Support & Resources

### Documentation

- **README.md** - Technical documentation and setup guide
- **USER_GUIDE.md** (this file) - User and developer guide

### External Resources

- [GOV.UK Design System](https://design-system.service.gov.uk/)
- [Hapi.js Documentation](https://hapi.dev/)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [Webpack Documentation](https://webpack.js.org/)

### Getting Help

For issues or questions:

1. Check this user guide
2. Review the README.md
3. Check application logs
4. Contact the development team

---

## Changelog

### Version 1.0 (January 5, 2026)

- Initial release
- Document upload functionality
- CDP Uploader integration
- GOV.UK Design System implementation
- Session management with Redis support
- Health monitoring
- Production-ready configuration

---

**Document Version:** 1.0  
**Last Updated:** January 5, 2026  
**Maintained By:** DEFRA DDTS Team
