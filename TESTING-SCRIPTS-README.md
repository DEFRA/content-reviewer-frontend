# Frontend Testing Scripts - Summary

## Created Test Scripts

### 1. **test-frontend-dev.ps1** ✅

- Tests DEV environment frontend
- Checks homepage, assets, CSP, backend URL configuration
- Run: `.\test-frontend-dev.ps1`

### 2. **test-frontend-test.ps1** ✅

- Tests TEST environment frontend
- Same checks as DEV script
- Run: `.\test-frontend-test.ps1`

### 3. **test-frontend-prod.ps1** ✅

- Tests PROD environment frontend
- Same checks as DEV script
- Run: `.\test-frontend-prod.ps1`

### 4. **test-integration-e2e.ps1** ✅

- Tests both frontend AND backend together
- Verifies complete integration
- Checks CORS, CSP, API connectivity
- Run: `.\test-integration-e2e.ps1 -Environment dev`

## Quick Start

After deploying to CDP, run these commands from your Defra laptop:

```powershell
# Navigate to frontend directory
cd C:\path\to\ContentReviewerAI\frontend

# Test DEV environment (end-to-end)
.\test-integration-e2e.ps1

# Or test specific environment
.\test-integration-e2e.ps1 -Environment test
.\test-integration-e2e.ps1 -Environment prod
```

## What Gets Tested

### Frontend Tests

- ✅ Homepage loads (HTTP 200)
- ✅ Page title is correct
- ✅ Backend URL is configured correctly
- ✅ JavaScript and CSS assets are accessible
- ✅ Content Security Policy headers present
- ✅ CSP allows backend API connections

### Integration Tests (E2E)

- ✅ Frontend accessible
- ✅ Backend health check
- ✅ Frontend configured with correct backend URL
- ✅ Backend API endpoints working
- ✅ CORS configuration correct
- ✅ CSP allows backend connections

## Testing Workflow

```
1. Deploy Frontend + Backend to CDP
         ↓
2. Run Integration Test
   .\test-integration-e2e.ps1 -Environment dev
         ↓
3. All Automated Tests Pass?
   ├─ Yes → Proceed to Manual Testing
   └─ No → Check logs, fix issues, redeploy
         ↓
4. Manual Browser Testing
   - Upload document
   - Check status updates
   - Verify results display
   - Test review history
         ↓
5. All Manual Tests Pass?
   ├─ Yes → Environment is ready! 🎉
   └─ No → Debug in browser console
```

## Example Output

```powershell
PS> .\test-integration-e2e.ps1

========================================
E2E Integration Test - DEV
========================================

Frontend URL: https://content-reviewer-frontend.dev.cdp-int.defra.cloud
Backend URL:  https://content-reviewer-backend.dev.cdp-int.defra.cloud

[1/6] Testing frontend accessibility...
✓ Frontend is accessible

[2/6] Testing backend health...
✓ Backend health check passed
   Uptime: 3600s

[3/6] Verifying frontend backend configuration...
   Configured backend: https://content-reviewer-backend.dev.cdp-int.defra.cloud
✓ Frontend is configured with correct backend URL

[4/6] Testing backend API - Get reviews...
✓ Backend reviews API is accessible
   Total reviews: 42
   Recent reviews count: 5

[5/6] Checking CORS configuration...
✓ CORS is configured
   Allowed origin: *
   ✓ Frontend origin is allowed

[6/6] Verifying CSP allows backend connections...
✓ CSP allows connections to backend

========================================
Integration Test Summary - DEV
========================================

✓ Frontend and Backend are properly integrated!
```

## See Also

- **TESTING-GUIDE.md** - Detailed testing documentation
- **Backend tests** - `../backend/test-*.ps1`
- **Environment config** - `.env.*` files
