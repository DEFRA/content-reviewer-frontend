# File Upload Implementation Summary

## Overview

Implemented full file upload functionality that integrates with the backend API and adds uploaded files to the Review History table with proper workflow simulation.

## Key Features Implemented

### 1. **Real Backend Integration**

- Form submission now sends files to the backend API (`POST /api/upload`)
- Backend response includes `fileId`, `s3Location`, and other metadata
- Uses `FormData` API for multipart file upload
- Error handling for failed uploads

### 2. **Review History Persistence**

- All review history data is saved to `localStorage`
- Data persists across page navigation
- No more status re-evaluation when navigating back from results page
- Smart initialization: loads from localStorage if available, otherwise uses default dummy data

### 3. **Workflow Simulation**

- Uploading → Queued → Reviewing Content → Completed
- Each stage progresses after a delay (2s, 4s, 8s)
- Auto-progression only affects intermediate states, never final states (Completed/Failed)
- Statuses update every 10 seconds for demo purposes

### 4. **Dynamic Dummy Review Results**

- Different review findings for different document IDs:
  - ID `1001`: GOV.UK Service Standards (3 findings, score 85)
  - ID `1005`: Policy Update (2 findings, score 92)
  - Any other ID: Default upload results (4 findings, score 78)
- Each result includes:
  - Summary scores (overall, readability, compliance)
  - Detailed findings with AI confidence levels
  - Specific recommendations
  - Workflow step tracking

### 5. **Reset Demo Data Button**

- Added "Reset Demo Data" button in Review History section
- Clears localStorage and reloads page
- Useful for demos and testing

## Files Modified

### Frontend

1. **`src/server/home/index.njk`**
   - Added localStorage persistence for review history
   - Implemented real file upload to backend API
   - Added error handling for upload failures
   - Added Reset Demo Data button and handler
   - Fixed status re-evaluation issue

2. **`src/server/review/results/controller.js`**
   - Added 'default' dummy data set for newly uploaded files
   - Enhanced with more varied review findings
   - Changed LLM model to "AWS Bedrock - Claude 3.5 Sonnet"

3. **`src/server/review/results/index.njk`**
   - Fixed date filter usage (`formatDate` instead of `date`)

4. **`src/config/nunjucks/context/context.js`**
   - Added CSP nonce to context for inline scripts

## Backend Requirements

### Backend Server Must Be Running

The backend server must be running on `http://localhost:3001` for file uploads to work.

**Start Backend:**

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-backend"
npm start
```

### API Endpoint

- **POST** `/api/upload`
- Accepts multipart form data with `file` field
- Returns JSON with:
  ```json
  {
    "fileId": "1736282345678",
    "filename": "document.pdf",
    "s3Location": "s3://bucket/uploads/document.pdf",
    "size": 12345,
    "mimeType": "application/pdf"
  }
  ```

## How It Works

### Upload Flow

1. User selects file and clicks "Review Content"
2. JavaScript creates FormData with the file
3. File is sent to backend via `POST /api/upload`
4. Backend uploads file to S3 and returns metadata
5. Frontend adds entry to Review History with "Uploading" status
6. Entry is saved to localStorage
7. Status progresses: Uploading → Queued → Reviewing Content → Completed
8. Each status change is saved to localStorage
9. User can click "View results" to see dummy LLM review

### Persistence Flow

1. On page load, check localStorage for existing review history
2. If found, load and use it
3. If not found, initialize with default dummy data
4. Every change (new upload, status progression) saves to localStorage
5. Data survives page navigation and browser refresh
6. "Reset Demo Data" button clears localStorage and reloads

## Testing

### Test File Upload

1. Open http://localhost:3000
2. Click "Choose File" and select a document (.pdf, .doc, .docx)
3. Click "Review Content"
4. Watch the status progress: Uploading → Queued → Reviewing Content → Completed
5. Click "View results" when completed
6. See dummy LLM review findings
7. Click "Back to home"
8. Verify status remains "Completed" (no re-evaluation)

### Test Persistence

1. Upload a file and wait for completion
2. Navigate to results page
3. Click "Back to home"
4. Refresh browser (F5)
5. Verify all review history is still there with correct statuses

### Test Reset

1. Click "Reset Demo Data" button
2. Confirm the dialog
3. Page reloads with original dummy data

## Known Limitations

1. **No Real LLM Processing**: Results are dummy data, not actual AI analysis
2. **No Real S3/SQS Integration**: Workflow simulation is client-side only
3. **Backend AWS Errors**: SQS worker will show credential errors (expected without AWS config)
4. **localStorage Limits**: Browser storage has size limits (usually 5-10MB)

## Next Steps for Production

1. **Real LLM Integration**
   - Connect to AWS Bedrock
   - Process uploaded files with Claude 3.5 Sonnet
   - Store actual results in S3

2. **Database Integration**
   - Replace localStorage with backend database (MongoDB)
   - Implement proper API endpoints for review history
   - Add authentication and user sessions

3. **SQS Workflow**
   - Configure AWS credentials
   - Enable real SQS message processing
   - Implement background job processing

4. **Real-time Updates**
   - Use WebSockets or polling to get real status updates from backend
   - Show live progress of LLM processing
   - Update UI automatically when review completes

## Configuration

### Backend API URL

Default: `http://localhost:3001`

To change, update in `src/server/home/index.njk`:

```javascript
window.APP_CONFIG = {
  backendApiUrl: 'http://your-backend-url:port'
}
```

### Workflow Timing

Default delays (in `src/server/home/index.njk`):

- Uploading → Queued: 2 seconds
- Queued → Reviewing Content: 4 seconds (cumulative)
- Reviewing Content → Completed: 8 seconds (cumulative)
- Auto-progression interval: 10 seconds

## Browser Compatibility

- Requires modern browser with:
  - localStorage support
  - fetch API
  - FormData API
  - ES6+ JavaScript features

## Summary

✅ File uploads work and send to backend  
✅ Review history persists across navigation  
✅ Status progression simulates real workflow  
✅ No more re-evaluation of completed items  
✅ Dummy LLM results display for all uploads  
✅ Reset functionality for demos  
✅ Ready for real AWS Bedrock integration
