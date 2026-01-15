# Quick test runner for debugging
cd "c:\Users\2417710\OneDrive - Cognizant\Desktop\ContentReviewerAI\frontend"

Write-Host "Running home controller test..." -ForegroundColor Cyan
npm test -- src/server/home/controller.test.js --no-coverage

Write-Host "`nRunning CSP test..." -ForegroundColor Cyan
npm test -- src/server/common/helpers/content-security-policy.test.js --no-coverage
