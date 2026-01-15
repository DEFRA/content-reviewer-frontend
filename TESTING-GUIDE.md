# Frontend Testing Guide

This directory contains PowerShell test scripts to verify the frontend deployment in different CDP environments.

## Test Scripts

### Individual Environment Tests

Test the frontend in a specific environment:

```powershell
# Test DEV environment
.\test-frontend-dev.ps1

# Test TEST environment
.\test-frontend-test.ps1

# Test PROD environment
.\test-frontend-prod.ps1
```

These scripts check:

- ✅ Homepage loads successfully
- ✅ Page title is correct
- ✅ Backend URL is properly configured
- ✅ Required assets (JS/CSS) are accessible
- ✅ Content Security Policy headers are set correctly

### End-to-End Integration Test

Test both frontend and backend together:

```powershell
# Test DEV environment (default)
.\test-integration-e2e.ps1

# Test TEST environment
.\test-integration-e2e.ps1 -Environment test

# Test PROD environment
.\test-integration-e2e.ps1 -Environment prod
```

This script verifies:

- ✅ Frontend is accessible
- ✅ Backend health check passes
- ✅ Frontend has correct backend URL configured
- ✅ Backend API endpoints are working
- ✅ CORS is properly configured
- ✅ CSP allows backend API calls

## Running Tests After Deployment

### Quick Test After Deployment

1. Deploy both frontend and backend to CDP
2. Run the integration test:
   ```powershell
   .\test-integration-e2e.ps1 -Environment dev
   ```
3. If all tests pass, proceed with manual UI testing

### Manual UI Testing Checklist

After automated tests pass, test the UI manually:

1. **Open the frontend in a browser**
   - DEV: https://content-reviewer-frontend.dev.cdp-int.defra.cloud
   - TEST: https://content-reviewer-frontend.test.cdp-int.defra.cloud
   - PROD: https://content-reviewer-frontend.prod.cdp-int.defra.cloud

2. **Open browser developer tools (F12)**
   - Check Console tab for JavaScript errors
   - Check Network tab to verify API calls

3. **Test document upload**
   - Click "Upload" or navigate to upload page
   - Select a test document (PDF, DOCX, etc.)
   - Submit the form
   - Verify you're redirected to status/results page

4. **Test review status polling**
   - After upload, you should see status updates
   - Status should change from "pending" → "processing" → "completed"
   - Check that polling stops when review is complete

5. **Test review results**
   - Verify review results display correctly
   - Check that AI suggestions are shown
   - Ensure feedback is properly formatted

6. **Test review history**
   - Navigate to review history page
   - Verify previous reviews are listed
   - Check that you can click into individual reviews

## Troubleshooting

### Frontend Not Loading

```
✗ Failed to load homepage
```

**Possible causes:**

- Frontend not deployed to CDP
- DNS not configured
- Service crashed on startup

**Check:**

1. CDP deployment logs
2. CDP service status
3. Environment variables set correctly

### Backend URL Mismatch

```
✗ Backend URL mismatch!
```

**Possible causes:**

- `BACKEND_URL` environment variable not set in CDP
- Wrong value in environment variable
- `.env.*` files not being loaded

**Fix:**

1. Check CDP environment variables for the service
2. Ensure `BACKEND_URL` is set to: `https://content-reviewer-backend.{env}.cdp-int.defra.cloud`
3. Redeploy if needed

### CORS Errors in Browser

```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```

**Fix:**

1. Check backend CORS configuration
2. Ensure backend allows the frontend origin
3. Run: `.\test-integration-e2e.ps1` to verify CORS

### CSP Blocking API Calls

```
Refused to connect to 'https://...' because it violates the following Content Security Policy directive
```

**Fix:**

1. Check that backend URL is in CSP `connect-src`
2. Verify CSP in `frontend/src/server/common/helpers/content-security-policy.js`
3. Ensure all environment backend URLs are listed

### Assets Not Loading (404)

```
✗ /public/assets/javascripts/application.js not found
```

**Possible causes:**

- Build step didn't run
- Static files not deployed
- Incorrect asset paths

**Fix:**

1. Run `npm run build:frontend` locally to verify build works
2. Check CDP build logs
3. Ensure `.public` directory is included in deployment

## Testing Workflow

### After Each Deployment

```powershell
# 1. Test the specific environment
.\test-integration-e2e.ps1 -Environment dev

# 2. If tests pass, do manual testing in browser
# 3. Upload a test document
# 4. Verify end-to-end flow works
# 5. Check browser console for errors
```

### Before Promoting to Next Environment

```powershell
# Test current environment thoroughly
.\test-integration-e2e.ps1 -Environment dev

# Deploy to next environment
# ...deployment commands...

# Test new environment
.\test-integration-e2e.ps1 -Environment test
```

### Continuous Monitoring

Consider setting up scheduled tests:

```powershell
# Run integration tests every hour
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\path\to\test-integration-e2e.ps1 -Environment prod"
Register-ScheduledTask -TaskName "ContentReviewer-HealthCheck" -Trigger $trigger -Action $action
```

## Environment URLs

### DEV

- Frontend: https://content-reviewer-frontend.dev.cdp-int.defra.cloud
- Backend: https://content-reviewer-backend.dev.cdp-int.defra.cloud

### TEST

- Frontend: https://content-reviewer-frontend.test.cdp-int.defra.cloud
- Backend: https://content-reviewer-backend.test.cdp-int.defra.cloud

### PROD

- Frontend: https://content-reviewer-frontend.prod.cdp-int.defra.cloud
- Backend: https://content-reviewer-backend.prod.cdp-int.defra.cloud

## Related Documentation

- Backend testing scripts: `../backend/test-*.ps1`
- Environment configuration: `.env.*` files
- CSP configuration: `src/server/common/helpers/content-security-policy.js`
- Backend URL configuration: `src/config/config.js`
