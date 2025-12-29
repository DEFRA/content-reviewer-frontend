# Quick Reference Card

## URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Upload Form**: http://localhost:3000/upload/form

## Start Services

```powershell
# Frontend (Port 3000)
npm run dev

# Backend (Port 3001)
cd ../content-reviewer-backend
npm start
```

## File Upload Limits

- **Max Size**: 10MB
- **Types**: PDF (.pdf), Word (.doc, .docx)
- **Storage**: S3 (dev-service-optimisation-c63f2)

## Common Commands

```powershell
# Build frontend assets
npm run build:frontend

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Key Files

| File                                             | Purpose              |
| ------------------------------------------------ | -------------------- |
| `src/client/javascripts/upload-handler.js`       | Upload logic         |
| `src/client/stylesheets/components/_upload.scss` | Upload styles        |
| `src/server/upload/upload-form.njk`              | Upload form template |
| `src/server/home/index.njk`                      | Main chat page       |
| `src/config/config.js`                           | App configuration    |

## Troubleshooting Quick Fixes

**Upload not working?**

```powershell
# Check backend is running
curl http://localhost:3001/api/upload/health

# Rebuild frontend
npm run build:frontend
```

**CSP errors?**

```powershell
# Rebuild assets (removes inline styles/scripts)
npm run build:frontend
```

**Styling broken?**

```powershell
# Force rebuild and hard refresh
npm run build:frontend
# Then Ctrl+Shift+R in browser
```

## Environment Variables

```bash
# Required
PORT=3000
AWS_REGION=eu-west-2
UPLOAD_S3_BUCKET=dev-service-optimisation-c63f2

# Optional (Development defaults)
NODE_ENV=development
SESSION_CACHE_ENGINE=memory
BACKEND_URL=http://localhost:3001
```

## API Endpoints

**Upload File:**

```http
POST http://localhost:3001/api/upload
Content-Type: multipart/form-data
Body: file=<binary>
```

**Upload Health:**

```http
GET http://localhost:3001/api/upload/health
```

## Success Response Example

```json
{
  "success": true,
  "uploadId": "abc123",
  "filename": "document.pdf",
  "size": 204800,
  "s3Location": "s3://dev-service-optimisation-c63f2/content-uploads/abc123/document.pdf"
}
```

---

For complete documentation, see **[DOCUMENTATION.md](./DOCUMENTATION.md)**
