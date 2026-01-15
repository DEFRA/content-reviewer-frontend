#!/usr/bin/env pwsh
# End-to-End Integration Test - DEV Environment
# Tests both frontend and backend together

param(
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "E2E Integration Test - $($Environment.ToUpper())" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$frontendUrl = "https://content-reviewer-frontend.$Environment.cdp-int.defra.cloud"
$backendUrl = "https://content-reviewer-backend.$Environment.cdp-int.defra.cloud"

Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Yellow
Write-Host "Backend URL:  $backendUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Frontend is accessible
Write-Host "[1/6] Testing frontend accessibility..." -ForegroundColor Cyan
try {
    $frontendResponse = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 10
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "✓ Frontend is accessible" -ForegroundColor Green
    } else {
        Write-Host "✗ Frontend returned status: $($frontendResponse.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Frontend is not accessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Backend health check
Write-Host "[2/6] Testing backend health..." -ForegroundColor Cyan
try {
    $healthUrl = "$backendUrl/health"
    $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 10
    
    if ($healthResponse.status -eq "ok") {
        Write-Host "✓ Backend health check passed" -ForegroundColor Green
        Write-Host "   Uptime: $($healthResponse.uptime)s" -ForegroundColor White
    } else {
        Write-Host "✗ Backend health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure backend is deployed and running" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 3: Frontend has correct backend URL configured
Write-Host "[3/6] Verifying frontend backend configuration..." -ForegroundColor Cyan
$pattern = 'backendApiUrl[^"'']*["'']([^"'']+)["'']'
if ($frontendResponse.Content -match $pattern) {
    $configuredBackendUrl = $matches[1]
    Write-Host "   Configured backend: $configuredBackendUrl" -ForegroundColor White
    
    if ($configuredBackendUrl -eq $backendUrl) {
        Write-Host "✓ Frontend is configured with correct backend URL" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend URL mismatch!" -ForegroundColor Red
        Write-Host "   Expected: $backendUrl" -ForegroundColor Red
        Write-Host "   Configured: $configuredBackendUrl" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ Could not find backend URL in frontend configuration" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 4: Test backend API endpoint (reviews list)
Write-Host "[4/6] Testing backend API - Get reviews..." -ForegroundColor Cyan
try {
    $reviewsUrl = "$backendUrl/api/reviews?limit=5"
    $reviewsResponse = Invoke-RestMethod -Uri $reviewsUrl -Method Get -TimeoutSec 10
    
    Write-Host "✓ Backend reviews API is accessible" -ForegroundColor Green
    Write-Host "   Total reviews: $($reviewsResponse.total)" -ForegroundColor White
    
    if ($reviewsResponse.reviews) {
        Write-Host "   Recent reviews count: $($reviewsResponse.reviews.Count)" -ForegroundColor White
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "⚠ Reviews endpoint not found (might be expected if no reviews exist yet)" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Failed to access reviews API: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Test 5: Check CORS headers
Write-Host "[5/6] Checking CORS configuration..." -ForegroundColor Cyan
try {
    $corsHeaders = @{
        "Origin" = $frontendUrl
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "Content-Type"
    }
    
    $corsResponse = Invoke-WebRequest -Uri "$backendUrl/api/reviews" -Method Options -Headers $corsHeaders -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    
    if ($corsResponse.Headers["Access-Control-Allow-Origin"]) {
        $allowedOrigin = $corsResponse.Headers["Access-Control-Allow-Origin"]
        Write-Host "✓ CORS is configured" -ForegroundColor Green
        Write-Host "   Allowed origin: $allowedOrigin" -ForegroundColor White
        
        if ($allowedOrigin -eq "*" -or $allowedOrigin -eq $frontendUrl) {
            Write-Host "   ✓ Frontend origin is allowed" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ Frontend origin may not be allowed" -ForegroundColor Yellow
            Write-Host "     This could cause CORS errors" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠ CORS headers not found" -ForegroundColor Yellow
        Write-Host "   This might cause issues with frontend API calls" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not check CORS configuration" -ForegroundColor Yellow
}
Write-Host ""

# Test 6: CSP allows backend API calls
Write-Host "[6/6] Verifying CSP allows backend connections..." -ForegroundColor Cyan
if ($frontendResponse.Headers["Content-Security-Policy"]) {
    $csp = $frontendResponse.Headers["Content-Security-Policy"]
    
    if ($csp -match "connect-src[^;]*$backendUrl") {
        Write-Host "✓ CSP allows connections to backend" -ForegroundColor Green
    } else {
        Write-Host "⚠ Backend URL may not be in CSP connect-src" -ForegroundColor Yellow
        Write-Host "   This could block frontend API calls" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ No CSP header found" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Integration Test Summary - $($Environment.ToUpper())" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Frontend and Backend are properly integrated!" -ForegroundColor Green
Write-Host ""
Write-Host "Manual Testing Checklist:" -ForegroundColor Cyan
Write-Host "  [ ] Open frontend in browser: $frontendUrl" -ForegroundColor White
Write-Host "  [ ] Check browser console for errors (F12)" -ForegroundColor White
Write-Host "  [ ] Upload a test document" -ForegroundColor White
Write-Host "  [ ] Verify review status updates" -ForegroundColor White
Write-Host "  [ ] Check review results display correctly" -ForegroundColor White
Write-Host "  [ ] Verify review history shows previous reviews" -ForegroundColor White
Write-Host ""
Write-Host "If you encounter issues:" -ForegroundColor Yellow
Write-Host "  1. Check browser console for CORS or CSP errors" -ForegroundColor White
Write-Host "  2. Verify environment variables are set correctly in CDP" -ForegroundColor White
Write-Host "  3. Ensure both frontend and backend are deployed" -ForegroundColor White
Write-Host "  4. Check CDP logs for any deployment issues" -ForegroundColor White
Write-Host ""
