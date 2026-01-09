# Homepage Upload Implementation Summary

## Overview

This document describes the implementation of the AJAX-based file upload functionality on the homepage, which replaces the previous multi-page upload workflow.

## Changes Implemented

### 1. **Removed Upload Page Navigation**

- **Removed**: Separate `/upload` route and page
- **Changed**: Router configuration to exclude upload module
- **File**: `src/server/router.js`

```javascript
// Before: await server.register([home, about, upload, review])
// After: await server.register([home, about, review])
```

### 2. **Homepage AJAX Upload Form**

The homepage (`src/server/home/index.njk`) now includes:

- File upload form with drag-and-drop support
- AJAX submission handler (stays on same page)
- Real-time progress indicator
- Auto-refresh of review history table

### 3. **API Upload Endpoint**

Created new API endpoint for file uploads:

- **Route**: `/api/upload` (POST)
- **File**: `src/server/api/upload.js`
- **Functionality**:
  - Validates file type and size
  - Forwards to backend API
  - Returns JSON response

### 4. **Review History Auto-Refresh**

The review history table auto-refreshes:

- **Trigger**: When active reviews exist (uploading, queued, processing, analyzing)
- **Interval**: Every 3 seconds
- **Stops**: When all reviews complete or fail

## User Flow

### Upload Process

1. User selects file on homepage
2. User clicks "Review Content" button
3. Frontend validation (file type, size)
4. AJAX upload to `/api/upload`
5. **Page stays on homepage** (no redirect)
6. Progress indicator shows: "Uploading to S3..."
7. Success message displayed
8. Page refreshes to show new review in history table

### Status Progression

User sees real-time status updates in the Review History table:

1. **Uploading** (blue badge) - File being uploaded to S3
2. **Queued** (yellow badge) - Message in SQS queue
3. **Reviewing Content** (yellow badge) - LLM processing document
4. **Completed** (green badge) - Review complete, results available
5. **Failed** (red badge) - Error occurred

## Technical Details

### File Validation

- **Allowed types**: PDF (.pdf), Word (.doc, .docx)
- **Maximum size**: 10MB
- **Validation**: Both frontend and backend

### Status Polling

```javascript
// Auto-refresh logic in homepage
if (hasActiveReviews) {
  setInterval(() => {
    window.location.reload()
  }, 3000) // Refresh every 3 seconds
}
```

### Review History Display

The table shows:

- **Uploaded Document**: Filename
- **Method**: "Review Content"
- **Status**: Color-coded badge
- **Timestamp**: Upload date/time
- **Result**: Link to results or status message

## Files Modified

### Frontend Files

1. `src/server/router.js` - Removed upload module registration
2. `src/server/home/index.njk` - Added AJAX upload form and auto-refresh
3. `src/server/api/upload.js` - New API endpoint (created)

### Dependencies Added

- `form-data`: For multipart form data handling
- `node-fetch`: For backend API calls (if not already installed)

## Testing

### Test the Upload Flow

1. Start backend: `npm run dev` (in backend folder)
2. Start frontend: `npm run dev` (in frontend folder)
3. Open browser: `http://localhost:3000`
4. Select a PDF or Word document
5. Click "Review Content"
6. Verify:
   - Page stays on homepage
   - Progress indicator shows
   - Review appears in history table
   - Status updates automatically

### Verify Status Transitions

1. Upload a document
2. Watch the Review History table auto-refresh
3. Status should progress:
   - Uploading → Queued → Reviewing Content → Completed

### Test Error Handling

1. Try uploading invalid file type (e.g., .txt)
2. Try uploading file >10MB
3. Verify error messages display correctly

## Backend Integration

The frontend upload API forwards files to the backend:

- **Backend endpoint**: `http://localhost:3001/api/upload`
- **Expected response**:

```json
{
  "success": true,
  "reviewId": "uuid-here",
  "filename": "document.pdf",
  "message": "File uploaded successfully"
}
```

## Environment Configuration

No frontend environment changes required. The backend URL is configured via:

```javascript
// In frontend config
backendUrl: process.env.BACKEND_URL || 'http://localhost:3001'
```

## Benefits

1. ✅ **No page navigation** - User stays on homepage
2. ✅ **Real-time updates** - Status changes visible immediately
3. ✅ **Better UX** - Progress indicator and auto-refresh
4. ✅ **Simplified workflow** - One page for upload and results
5. ✅ **Consistent state** - Review history always visible

## Future Enhancements

Consider adding:

- WebSocket connection for instant status updates (instead of polling)
- File upload progress bar (0-100%)
- Multiple file upload support
- Pause/cancel upload functionality
- Client-side document preview

## Troubleshooting

### Upload fails with "Backend upload failed"

- Check backend is running: `http://localhost:3001/health`
- Verify backend .env configuration
- Check LocalStack S3 bucket exists: `content-review`

### Review history not updating

- Check browser console for errors
- Verify backend API returns review data: `http://localhost:3001/api/review-history`
- Check auto-refresh is active (console should show "Active reviews detected")

### File validation fails

- Verify file type is PDF or Word (.pdf, .doc, .docx)
- Check file size is under 10MB
- Try different browser if issues persist

## Related Documentation

- [Frontend AI Integration Complete](./FRONTEND_AI_INTEGRATION_COMPLETE.md)
- [File Upload Implementation](./FILE_UPLOAD_IMPLEMENTATION.md)
- [Quick Test Guide](./QUICK_TEST_GUIDE.md)
