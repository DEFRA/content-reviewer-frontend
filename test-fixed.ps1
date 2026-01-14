#!/usr/bin/env pwsh
# Quick test script for the two fixed tests

Write-Host "Running the two fixed tests..." -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Run the two specific tests
npm test -- src/server/home/controller.test.js src/server/common/helpers/content-security-policy.test.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "Tests failed!" -ForegroundColor Red
    exit 1
}
