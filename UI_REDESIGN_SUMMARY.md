# Content Reviewer Frontend - UI Redesign Summary

## Changes Implemented

### 1. Home Page Redesign (`src/server/home/index.njk`)

#### Removed:

- Left sidebar with conversation history
- Chat-style interface
- Conversation list

#### Added:

- Clean, form-based layout
- Two separate sections:
  1. **Upload Document Section**
     - File upload input
     - "Upload Document" button
     - File type and size restrictions displayed
  2. **Direct Content Input Section**
     - Text area for pasting content
     - "Review Content" button (renamed from "Send")

  3. **Review History Table**
     - Displays all submitted reviews in a tabular format
     - Headers:
       - **Uploaded Document**: Shows document name or content preview
       - **Method**: Shows "File Upload" or "Direct Input"
       - **Status**: Shows current status with color-coded tags
         - Uploading (Blue)
         - Queued (Yellow)
         - Reviewing Content (Purple)
         - Completed (Green)
         - Failed (Red)
       - **Timestamp**: Shows date and time of submission
       - **Actions**: "View results" link (only shown when status is Completed)

### 2. Results Page Created

New files created:

- `src/server/review/index.js` - Plugin registration
- `src/server/review/results/index.js` - Route definition
- `src/server/review/results/controller.js` - Controller with mock data
- `src/server/review/results/index.njk` - Results view template

#### Results Page Features:

- **Document Information Summary**
  - Document name
  - Review date
  - Status

- **Export Options**
  - "Export as PDF" button
  - "Export as Word" button
  - (Currently shows alerts - needs backend implementation)

- **Review Summary Cards**
  - Overall Score (numeric)
  - Readability Score
  - Compliance Score
  - Issues Found count

- **Findings Section**
  - Lists all issues found
  - Each finding shows:
    - Category (Readability, Formatting, GOV.UK Standards, etc.)
    - Severity level (High/Medium/Low with color-coded tags)
    - Description of the issue
    - Location in document
    - Suggestion for improvement

- **Recommendations Section**
  - Bulleted list of improvement recommendations

- **Navigation**
  - Back button to return home
  - "Review Another Document" button

### 3. Router Updates (`src/server/router.js`)

- Registered new review routes
- Added import for review module

### 4. Status Flow

The table dynamically updates to show the progression:

1. **Uploading** - File is being uploaded
2. **Queued** - Waiting for processing
3. **Reviewing Content** - AI is analyzing the content
4. **Completed** - Review is finished, results available
5. **Failed** - Error occurred (optional state)

### 5. Mock Data & Functionality

Currently implemented with:

- Client-side mock data for demonstration
- Simulated status progression with timeouts
- Sample review results with findings and recommendations

### Next Steps for Full Implementation:

1. **Backend Integration**
   - Connect upload form to actual upload API
   - Store review requests in database
   - Implement status polling from backend
   - Create API endpoint for review history

2. **Export Functionality**
   - Implement PDF generation (using libraries like pdfkit or puppeteer)
   - Implement Word document generation (using docx library)
   - Add download endpoints

3. **Real-time Updates**
   - Implement WebSocket or polling for status updates
   - Auto-refresh table when new results are available

4. **Data Persistence**
   - Store review history in database
   - Link reviews to user sessions/accounts
   - Implement pagination for large result sets

5. **Enhanced Features**
   - Search and filter in review history
   - Sort by different columns
   - Delete/archive old reviews
   - Detailed error messages for failed reviews

## Testing the Changes

1. Navigate to the home page
2. Upload a document or enter text content
3. Click "Upload Document" or "Review Content"
4. Watch the status progress in the table
5. When status shows "Completed", click "View results"
6. On results page, see the review findings
7. Try the export buttons (currently shows placeholder alerts)

## File Structure

```
src/server/
├── home/
│   └── index.njk (redesigned)
├── review/
│   ├── index.js (new)
│   └── results/
│       ├── index.js (new)
│       ├── controller.js (new)
│       └── index.njk (new)
└── router.js (updated)
```
