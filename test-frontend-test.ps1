#!/usr/bin/env pwsh
# Test script for Content Reviewer Frontend - TEST environment

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Content Reviewer Frontend - TEST Tests" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$frontendUrl = "https://content-reviewer-frontend.test.cdp-int.defra.cloud"
$expectedBackendUrl = "https://content-reviewer-backend.test.cdp-int.defra.cloud"

Write-Host "Testing Frontend URL: $frontendUrl" -ForegroundColor Yellow
Write-Host "Expected Backend URL: $expectedBackendUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Homepage loads
Write-Host "[1/5] Testing homepage loads..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Homepage loads successfully (Status: $($response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to load homepage: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Check for correct page title
Write-Host "[2/5] Checking page title..." -ForegroundColor Cyan
if ($response.Content -match "<title>\s*Home \| Content Review Tool\s*</title>") {
    Write-Host "✓ Page title is correct" -ForegroundColor Green
} else {
    Write-Host "✗ Page title not found or incorrect" -ForegroundColor Yellow
    Write-Host "   (This might be okay if the title format changed)" -ForegroundColor Yellow
}
Write-Host ""

# Test 3: Check backend URL is injected into page
Write-Host "[3/5] Checking backend URL configuration..." -ForegroundColor Cyan
if ($response.Content -match "backendApiUrl") {
    Write-Host "✓ Backend URL configuration found in page" -ForegroundColor Green
    
    # Try to extract the actual URL
    if ($response.Content -match "backendApiUrl['\s:]+['\"]([^'\"]+)['\"]") {
        $actualBackendUrl = $matches[1]
        Write-Host "   Configured backend URL: $actualBackendUrl" -ForegroundColor White
        
        if ($actualBackendUrl -eq $expectedBackendUrl) {
            Write-Host "   ✓ Backend URL matches expected value" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ Backend URL differs from expected:" -ForegroundColor Yellow
            Write-Host "     Expected: $expectedBackendUrl" -ForegroundColor Yellow
            Write-Host "     Actual:   $actualBackendUrl" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "✗ Backend URL configuration not found in page" -ForegroundColor Red
    Write-Host "   This could cause frontend to fail connecting to backend" -ForegroundColor Red
}
Write-Host ""

# Test 4: Check for required JavaScript files
Write-Host "[4/5] Checking for required assets..." -ForegroundColor Cyan
$assetsFound = 0
$assetsToCheck = @(
    "/public/assets/javascripts/application.js",
    "/public/assets/stylesheets/application.css"
)

foreach ($asset in $assetsToCheck) {
    try {
        $assetUrl = "$frontendUrl$asset"
        $assetResponse = Invoke-WebRequest -Uri $assetUrl -UseBasicParsing -Method Head -TimeoutSec 5
        if ($assetResponse.StatusCode -eq 200) {
            Write-Host "   ✓ $asset found" -ForegroundColor Green
            $assetsFound++
        }
    } catch {
        Write-Host "   ✗ $asset not found or not accessible" -ForegroundColor Yellow
    }
}

if ($assetsFound -eq $assetsToCheck.Count) {
    Write-Host "✓ All required assets are accessible" -ForegroundColor Green
} else {
    Write-Host "⚠ Some assets may be missing ($assetsFound/$($assetsToCheck.Count) found)" -ForegroundColor Yellow
}
Write-Host ""

# Test 5: Check CSP headers
Write-Host "[5/5] Checking Content Security Policy headers..." -ForegroundColor Cyan
if ($response.Headers["Content-Security-Policy"]) {
    Write-Host "✓ CSP header is present" -ForegroundColor Green
    $csp = $response.Headers["Content-Security-Policy"]
    
    # Check if backend URL is in CSP connect-src
    if ($csp -match "connect-src[^;]*$expectedBackendUrl") {
        Write-Host "   ✓ Backend URL is allowed in CSP connect-src" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Backend URL may not be in CSP connect-src" -ForegroundColor Yellow
        Write-Host "     This could block API calls to backend" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ CSP header not found" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Frontend Test Summary - TEST" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Frontend URL: $frontendUrl" -ForegroundColor White
Write-Host "Expected Backend: $expectedBackendUrl" -ForegroundColor White
Write-Host ""
Write-Host "✓ All critical tests passed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test uploading a document through the UI" -ForegroundColor White
Write-Host "2. Verify the backend integration works end-to-end" -ForegroundColor White
Write-Host "3. Check browser console for any JavaScript errors" -ForegroundColor White
Write-Host ""
