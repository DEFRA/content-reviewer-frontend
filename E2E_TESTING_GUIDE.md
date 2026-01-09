# End-to-End Testing Guide

## Overview

This guide helps you test the complete AI content review workflow from file upload to results display.

## Prerequisites

1. ✅ **LocalStack running** with S3 and SQS
2. ✅ **Backend server** running on port 3001
3. ✅ **Frontend server** running on port 3000
4. ✅ **Test document** ready (PDF or Word, <10MB)

## Quick Start Commands

### Terminal 1: Start LocalStack (if not already running)

```powershell
podman ps  # Check if LocalStack is running
# If not running:
podman run -d `
  --name localstack `
  -p 4566:4566 `
  -e SERVICES=s3,sqs `
  -e DEBUG=1 `
  localstack/localstack:latest
```

### Terminal 2: Start Backend

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-backend"
npm run dev
```

### Terminal 3: Start Frontend

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-frontend"
npm run dev
```

## Test Workflow

### Step 1: Verify Services Are Running

#### Check LocalStack

```powershell
podman exec localstack awslocal s3 ls
# Should show: content-review

podman exec localstack awslocal sqs list-queues
# Should show: content_review_status.fifo
```

#### Check Backend

```powershell
curl http://localhost:3001/health
# Should return: {"statusCode":200,"status":"OK"}
```

#### Check Frontend

Open browser: `http://localhost:3000`

### Step 2: Test File Upload

1. **Open Homepage**: Navigate to `http://localhost:3000`
2. **Select File**: Click file input and choose a PDF or Word document
3. **Upload**: Click "Review Content" button
4. **Verify**:
   - Page stays on homepage (no redirect)
   - Progress indicator appears: "Uploading to S3..."
   - Success message displays
   - Page refreshes automatically

### Step 3: Verify Review History

After upload, check the Review History table:

1. **New row appears** with uploaded document
2. **Status badge** shows:
   - 🔵 **Blue "Uploading"** - Initial state
   - 🟡 **Yellow "Queued"** - In SQS queue
   - 🟡 **Yellow "Reviewing Content"** - LLM processing
   - 🟢 **Green "Completed"** - Review finished

3. **Auto-refresh**: Page should reload every 3 seconds while status is active

### Step 4: Check Backend Processing

#### Monitor Backend Logs

Watch for these log messages:

```
File uploaded successfully to S3: <filename>
Message sent to SQS queue: content_review_status.fifo
Worker processing review: <reviewId>
AI review completed: <reviewId>
```

#### Check S3 Upload

```powershell
podman exec localstack awslocal s3 ls s3://content-review/content-uploads/
# Should show uploaded file
```

#### Check SQS Messages

```powershell
podman exec localstack awslocal sqs get-queue-attributes `
  --queue-url http://localhost:4566/000000000000/content_review_status.fifo `
  --attribute-names ApproximateNumberOfMessages
```

### Step 5: View Results

1. Wait for status to change to **"Completed"** (green badge)
2. Click **"View results"** link in Result column
3. Verify review results page displays:
   - Document information
   - AI recommendations
   - Compliance checks
   - Formatting suggestions

## Expected Timeline

For a typical document upload:

| Time | Status | Action |
|------|--------|--------|
| 0s | Uploading | Frontend uploads to backend |
| 1-2s | Queued | Backend uploads to S3 and sends SQS message |
| 3-5s | Reviewing Content | Worker picks up message and starts AI processing |
| 10-30s | Completed | AI review completes and results saved to S3 |

## Troubleshooting

### Upload Fails Immediately

**Symptom**: Error message "Upload failed"

**Checks**:

```powershell
# 1. Is backend running?
curl http://localhost:3001/health

# 2. Is LocalStack accessible?
curl http://localhost:4566

# 3. Does S3 bucket exist?
podman exec localstack awslocal s3 ls s3://content-review/
```

**Fix**:

```powershell
# Recreate S3 bucket
podman exec localstack awslocal s3 mb s3://content-review
```

### Status Stuck at "Uploading"

**Symptom**: Status doesn't progress from "Uploading"

**Checks**:

```powershell
# Check backend can access LocalStack S3
curl http://localhost:3001/api/review-history
```

**Possible causes**:
- Backend .env configuration incorrect
- S3_ENDPOINT not set to `http://localhost:4566`
- AWS credentials not set

**Fix**: Verify backend `.env` file:

```properties
AWS_ENDPOINT=http://localhost:4566
S3_ENDPOINT=http://localhost:4566
UPLOAD_S3_BUCKET=content-review
```

### Status Stuck at "Queued"

**Symptom**: Status doesn't progress from "Queued"

**Checks**:

```powershell
# 1. Check SQS queue exists
podman exec localstack awslocal sqs list-queues

# 2. Check messages in queue
podman exec localstack awslocal sqs get-queue-attributes `
  --queue-url http://localhost:4566/000000000000/content_review_status.fifo `
  --attribute-names ApproximateNumberOfMessages
```

**Possible causes**:
- SQS worker not running
- Worker polling wrong queue name
- SQS endpoint incorrect

**Fix**: Restart backend to reload environment:

```powershell
# In backend terminal, press Ctrl+C, then:
npm run dev
```

### Auto-Refresh Not Working

**Symptom**: Review history table doesn't update automatically

**Checks**:
1. Open browser console (F12)
2. Look for: "Active reviews detected - starting auto-refresh every 3 seconds..."

**Possible causes**:
- JavaScript error in browser
- Review status already "completed" or "failed"

**Fix**: Refresh page manually (F5)

### Results Not Displaying

**Symptom**: "View results" link shows error

**Checks**:

```powershell
# Check if results saved to S3
podman exec localstack awslocal s3 ls s3://content-review/results/
```

**Possible causes**:
- AI processing failed
- Results not saved to S3
- Wrong S3 path

**Fix**: Check backend logs for AI processing errors

## Advanced Testing

### Test File Validation

#### Invalid File Type

```javascript
// Try uploading a .txt file
// Expected: Error "Invalid file type. Please upload a PDF or Word document"
```

#### File Too Large

```javascript
// Try uploading >10MB file
// Expected: Error "File too large. Maximum size is 10MB..."
```

### Test Concurrent Uploads

1. Upload document A
2. Immediately upload document B
3. Verify both appear in review history
4. Verify both process independently

### Test Error Recovery

#### Simulate S3 Failure

```powershell
# Stop LocalStack temporarily
podman stop localstack

# Try upload - should fail gracefully
# Restart LocalStack
podman start localstack
```

## Performance Benchmarks

### Expected Response Times

- **File Upload**: < 2 seconds
- **S3 Upload**: < 3 seconds
- **SQS Message Send**: < 1 second
- **AI Processing**: 10-30 seconds (depending on document size)
- **Results Retrieval**: < 1 second

### Resource Usage

- **LocalStack**: ~200MB RAM
- **Backend**: ~100MB RAM
- **Frontend**: ~80MB RAM

## Test Checklist

Use this checklist to verify all functionality:

- [ ] LocalStack running with S3 and SQS
- [ ] Backend server healthy (`/health` endpoint)
- [ ] Frontend server accessible
- [ ] File upload form visible on homepage
- [ ] File validation works (type, size)
- [ ] Upload succeeds without page redirect
- [ ] Progress indicator displays
- [ ] Success message shows
- [ ] Review history table populates
- [ ] Auto-refresh activates
- [ ] Status progresses: Uploading → Queued → Reviewing → Completed
- [ ] "View results" link appears when completed
- [ ] Results page displays correctly
- [ ] Can upload another document immediately

## Next Steps

After verifying the basic workflow:

1. **Test with different document types** (PDF vs Word)
2. **Test with various document sizes** (1KB to 10MB)
3. **Test error scenarios** (network failures, timeouts)
4. **Monitor backend logs** for any warnings or errors
5. **Check S3 storage usage** (verify files are cleaned up if needed)

## Monitoring Commands

Keep these commands handy during testing:

### Watch Backend Logs

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-backend"
npm run dev  # Logs stream to console
```

### Monitor LocalStack

```powershell
# Watch LocalStack logs
podman logs -f localstack

# Check S3 bucket contents
podman exec localstack awslocal s3 ls s3://content-review/content-uploads/ --recursive

# Check SQS queue status
podman exec localstack awslocal sqs get-queue-attributes `
  --queue-url http://localhost:4566/000000000000/content_review_status.fifo `
  --attribute-names All
```

### Network Debugging

```powershell
# Check all listening ports
netstat -an | Select-String "3000|3001|4566"

# Test API endpoints
curl http://localhost:3001/api/review-history
curl http://localhost:3001/health
```

## Success Criteria

The system is working correctly when:

1. ✅ Files upload without page navigation
2. ✅ Review history updates in real-time
3. ✅ Status transitions happen automatically
4. ✅ Results are accessible after completion
5. ✅ No errors in browser console
6. ✅ No errors in backend logs
7. ✅ LocalStack receives and stores files
8. ✅ SQS messages are processed

## Support

If issues persist after following this guide:

1. Check all prerequisite services are running
2. Verify environment configuration (.env files)
3. Review backend and frontend logs for errors
4. Restart all services and try again
5. Check LocalStack container logs for issues
