# Content Reviewer Frontend - User Guide

## Overview

The Content Reviewer Frontend is a GOV.UK Design System compliant web application that provides an intuitive interface for reviewing content against GOV.UK standards using AI-powered analysis.

## Features

### 📤 Dual Input Methods
- **File Upload**: Upload documents (PDF, Word, .docx) up to 10MB
- **Text Input**: Paste content directly for instant review

### 📊 Review Management
- Real-time status updates with auto-refresh
- Review history with status tracking
- Animated progress indicators for active reviews
- Persistent results across sessions

### 📑 Results Display
- Overall assessment with scoring
- Detailed review sections (expandable accordion)
- Export options (JSON, Text, Print)
- Metrics dashboard (issues, word count, passive voice, etc.)

### 🔒 Security & Compliance
- CSP (Content Security Policy) compliant
- GOV.UK Design System
- Secure session management
- HTTPS enforced in production

---

## Quick Start

### Prerequisites
- Node.js 18+ 
- Backend service running on port 3001 (or configured URL)

### Installation

```bash
cd content-reviewer-frontend
npm install
```

### Configuration

Create a `.env` file:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Backend API
BACKEND_URL=http://localhost:3001

# Session
SESSION_COOKIE_PASSWORD=your-32-character-password-here

# Security
CONTENT_SECURITY_POLICY_ENABLED=true
```

### Run Locally

```bash
npm start
```

Visit: http://localhost:3000

---

## Using the Application

### Upload a Document

1. Navigate to the home page
2. Click "Choose File" under "Upload a document"
3. Select a PDF or Word document (max 10MB)
4. The file is automatically submitted
5. Monitor progress in the "Review History" table
6. Click "View results" when status shows "Completed"

### Review Text Content

1. Navigate to the home page
2. Type or paste content in the text area
3. Click "Review Content" button
4. Monitor progress in the "Review History" table
5. Click "View results" when status shows "Completed"

### View Results

The results page displays:

- **Overall Status**: Pass, Pass with Recommendations, Needs Improvement, or Fail
- **Summary Metrics**: Overall score, issues found, words to avoid, passive sentences
- **Document Information**: Filename, review date, AI model, processing time, tokens used
- **Detailed Sections** (expandable):
  - Content Quality
  - Plain English Review
  - GOV.UK Style Guide Compliance
  - Govspeak & Formatting Review
  - Accessibility Review
  - Passive Voice Analysis
  - Summary of Findings
  - Example Improvements

### Export Results

Three export options available:

1. **Download JSON**: Full review data in JSON format
2. **Download Text**: Formatted text report
3. **Print Report**: Print-friendly view

---

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Frontend server port | 3000 | No |
| `NODE_ENV` | Environment (development/production) | development | No |
| `BACKEND_URL` | Backend API URL | http://localhost:3001 | Yes |
| `SESSION_COOKIE_PASSWORD` | Session encryption key (32+ chars) | - | Yes |
| `CONTENT_SECURITY_POLICY_ENABLED` | Enable CSP headers | true | No |
| `SESSION_CACHE_TTL` | Session cache TTL (ms) | 7200000 | No |
| `LOG_LEVEL` | Logging level | info | No |

### Session Configuration

The application uses server-side session management with memory cache (development) or Redis (production recommended).

**Development** (memory cache):
```javascript
// Automatically configured when redis connection fails
```

**Production** (Redis):
```bash
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
```

---

## Project Structure

```
content-reviewer-frontend/
├── src/
│   ├── client/                 # Client-side code
│   │   ├── javascripts/
│   │   │   ├── application.js  # Main JS entry
│   │   │   └── upload-handler.js  # Upload & refresh logic
│   │   └── stylesheets/        # SCSS styles
│   ├── config/                 # Configuration
│   │   ├── config.js           # App configuration
│   │   └── nunjucks/           # Template engine setup
│   └── server/                 # Server-side code
│       ├── server.js           # Express server
│       ├── router.js           # Routes
│       ├── home/               # Home page controller
│       ├── review/             # Review results controllers
│       │   └── results/
│       │       ├── controller.js  # Results page logic
│       │       └── index.njk      # Results template
│       └── common/             # Shared utilities
│           ├── components/     # Reusable components
│           ├── helpers/        # Helper functions
│           └── templates/      # Nunjucks templates
├── .env                        # Environment config
├── package.json
└── webpack.config.js
```

---

## Development

### Run in Development Mode

```bash
npm run dev      # With auto-reload (if configured)
# or
npm start        # Standard mode
```

### Build for Production

```bash
npm run build    # Build assets
npm start        # Run production server
```

### Code Quality

```bash
npm test         # Run tests
npm run lint     # Lint code
npm run lint:fix # Fix linting issues
```

---

## Troubleshooting

### Upload Not Working

**Symptom**: File upload doesn't show in review history

**Solutions**:
1. Check backend is running: http://localhost:3001/health
2. Verify `BACKEND_URL` in `.env`
3. Check browser console for errors
4. Ensure file size is under 10MB
5. Verify file type (PDF, Word, .docx only)

### Results Page Shows 500 Error

**Symptom**: Clicking "View results" shows error page

**Solutions**:
1. Check backend logs for errors
2. Verify review completed successfully
3. Check backend API: `http://localhost:3001/api/status/{reviewId}`
4. Clear browser cache and retry
5. Check CSP errors in browser console

### Auto-Refresh Not Working

**Symptom**: Review history doesn't update automatically

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify `upload-handler.js` is loaded
3. Clear browser cache
4. Ensure no ad-blockers interfering with fetch requests

### Session Errors

**Symptom**: "Session error" or authentication issues

**Solutions**:
1. Verify `SESSION_COOKIE_PASSWORD` is set (32+ characters)
2. Check Redis connection (if using Redis)
3. Clear browser cookies
4. Restart frontend server

---

## API Integration

The frontend communicates with the backend via REST API:

### Endpoints Used

```
POST   /api/upload           - Upload document
POST   /api/review-text      - Submit text for review
GET    /api/status/{id}      - Get review status
GET    /api/review-history   - Get all reviews
```

### Request Flow

```
User Input → Frontend → Backend API → S3/SQS → AI Service → Results → Frontend
```

---

## Deployment

### CDP (Cloud Development Platform) Deployment

See the root [DEPLOYMENT-READINESS.md](../DEPLOYMENT-READINESS.md) for complete deployment instructions.

**Quick checklist**:
- [ ] Set all environment variables
- [ ] Configure session storage (Redis)
- [ ] Set `NODE_ENV=production`
- [ ] Configure backend URL (HTTPS)
- [ ] Enable CSP headers
- [ ] Test file upload and review workflow
- [ ] Verify results page displays correctly

### Environment-Specific Configuration

**Development**:
```bash
NODE_ENV=development
BACKEND_URL=http://localhost:3001
SESSION_CACHE_TTL=7200000  # 2 hours
```

**Production**:
```bash
NODE_ENV=production
BACKEND_URL=https://content-review-backend.cdp.defra.cloud
SESSION_CACHE_TTL=3600000  # 1 hour
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_TLS=true
```

---

## Support

### Logs

Logs are output to console in development. Configure logging level:

```bash
LOG_LEVEL=debug  # debug | info | warn | error
```

### Health Check

Frontend health: http://localhost:3000/health

Check backend connectivity from frontend logs.

---

## Related Documentation

- **Backend User Guide**: [../content-reviewer-backend/USER_GUIDE.md](../content-reviewer-backend/USER_GUIDE.md)
- **System Architecture**: [../DEPLOYMENT-READINESS.md](../DEPLOYMENT-READINESS.md)
- **Backend README**: [../content-reviewer-backend/README.md](../content-reviewer-backend/README.md)

---

## License

See [LICENCE](./LICENCE) file for details.
