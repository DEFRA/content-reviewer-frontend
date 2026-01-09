# Quick Start - Homepage Upload Testing

## 🚀 Start Everything (3 Steps)

### 1️⃣ Verify LocalStack is Running

```powershell
podman ps
# Should show: localstack container running on port 4566
```

If not running:

```powershell
podman run -d --name localstack -p 4566:4566 -e SERVICES=s3,sqs localstack/localstack:latest
```

### 2️⃣ Start Backend (Terminal 1)

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-backend"
npm run dev
```

Wait for: `Server started successfully on port 3001`

### 3️⃣ Start Frontend (Terminal 2)

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-frontend"
npm run dev
```

Wait for: `Server started successfully on port 3000`

## 🧪 Test Upload (5 Steps)

1. **Open Browser**: `http://localhost:3000`

2. **Select File**: Click file input, choose a PDF or Word document (<10MB)

3. **Click "Review Content"**: Button at bottom of form

4. **Verify Behavior**:
   - ✅ Page stays on homepage (no redirect!)
   - ✅ Progress indicator shows "Uploading to S3..."
   - ✅ Success message appears
   - ✅ Page refreshes automatically

5. **Watch Status Update**:
   - Review History table shows new row
   - Status badge changes color:
     - 🔵 Blue = Uploading
     - 🟡 Yellow = Queued
     - 🟡 Yellow = Reviewing Content
     - 🟢 Green = Completed
   - Table auto-refreshes every 3 seconds

## ✅ Success Checklist

- [ ] LocalStack running
- [ ] Backend healthy: `curl http://localhost:3001/health`
- [ ] Frontend accessible: `http://localhost:3000`
- [ ] Can select and upload file
- [ ] Page stays on homepage (no redirect)
- [ ] Review history table populates
- [ ] Status updates automatically
- [ ] Can click "View results" when complete

## 🐛 Quick Fixes

### Upload Button Does Nothing

**Check**: Browser console (F12) for errors

**Fix**: Refresh page (Ctrl+F5)

### "Upload Failed" Error

**Check**: Is backend running?

```powershell
curl http://localhost:3001/health
```

**Fix**: Restart backend

### Status Stuck at "Queued"

**Fix**: Restart backend to reload queue config

```powershell
# In backend terminal: Ctrl+C
npm run dev
```

### LocalStack Not Working

**Check**:

```powershell
podman exec localstack awslocal s3 ls
```

**Fix**: Recreate bucket

```powershell
podman exec localstack awslocal s3 mb s3://content-review
```

## 📊 Expected Timeline

| Time | Status | What's Happening |
|------|--------|------------------|
| 0s | Uploading | Sending to backend |
| 1-2s | Queued | File in S3, message in SQS |
| 3-5s | Reviewing Content | AI processing started |
| 10-30s | Completed | Results ready! |

## 🎯 Key Features

### ✨ What Changed

**BEFORE**: Upload → New Page → Status Page → Results Page

**NOW**: Everything on Homepage!

### 🎨 User Experience

1. Select file on homepage
2. Click "Review Content"
3. **Stay on same page**
4. See real-time status updates
5. Click "View results" when ready

### 🔄 Auto-Refresh

- Refreshes every **3 seconds** when reviews are active
- Stops automatically when all reviews complete
- No manual refresh needed!

## 📁 File Requirements

| Requirement | Value |
|-------------|-------|
| File Types | PDF (.pdf), Word (.doc, .docx) |
| Max Size | 10MB |
| Validation | Client and server side |

## 🔍 Monitoring Commands

### Check S3 Uploads

```powershell
podman exec localstack awslocal s3 ls s3://content-review/content-uploads/
```

### Check SQS Queue

```powershell
podman exec localstack awslocal sqs get-queue-attributes --queue-url http://localhost:4566/000000000000/content_review_status.fifo --attribute-names ApproximateNumberOfMessages
```

### Watch Backend Logs

Already streaming in Terminal 1 where backend is running

### Check Frontend Network

Open browser DevTools → Network tab → Watch API calls

## 📚 Full Documentation

- **Implementation Details**: `HOMEPAGE_UPLOAD_IMPLEMENTATION.md`
- **Complete Testing Guide**: `E2E_TESTING_GUIDE.md`
- **Summary**: `IMPLEMENTATION_COMPLETE.md`

## 🎉 That's It!

You're all set! The homepage upload is now fully functional with real-time status updates and no page navigation.

**Happy Testing! 🚀**
