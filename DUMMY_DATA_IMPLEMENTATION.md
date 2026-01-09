# Dummy Data and Workflow Simulation - Implementation Summary

## Overview

This document describes the dummy data implementation and workflow simulation for the Content Review application, demonstrating the full lifecycle from S3 upload to LLM processing and result presentation.

## Changes Implemented

### 1. Home Page - Review History Table

#### Dummy Data Added (6 Sample Records)

The table now displays 6 pre-populated records showing different stages of the workflow:

1. **GOV.UK_Service_Standards.pdf**
   - Status: Completed
   - Timestamp: 1 hour ago
   - Result: "View results" link

2. **Content_Guidelines_Draft.docx**
   - Status: Reviewing Content (LLM processing)
   - Timestamp: 5 minutes ago
   - Result: "LLM processing..."

3. **Accessibility_Report_2026.pdf**
   - Status: Queued (In SQS queue)
   - Timestamp: 2 minutes ago
   - Result: "In SQS queue..."

4. **User_Journey_Documentation.docx**
   - Status: Uploading (Uploading to S3)
   - Timestamp: 30 seconds ago
   - Result: "Uploading to S3..."

5. **Policy_Update_Jan2026.pdf**
   - Status: Completed
   - Timestamp: 2 hours ago
   - Result: "View results" link

6. **Service_Assessment_Notes.docx**
   - Status: Failed
   - Timestamp: 30 minutes ago
   - Result: "Review failed"

#### Column Changes

- **Column Renamed**: "Actions" → "Result"
- **Method Column**: All entries show "Review Content" instead of "File Upload" or "Direct Input"

#### Status Indicators with Workflow Context

Each status now shows specific workflow stage information:

- **Uploading** (Blue tag): "Uploading to S3..."
- **Queued** (Yellow tag): "In SQS queue..."
- **Reviewing Content** (Purple tag): "LLM processing..."
- **Completed** (Green tag): "View results" link
- **Failed** (Red tag): "Review failed"

### 2. Workflow Simulation

#### Complete Workflow Chain (8-second progression)

When a new document is submitted:

1. **0s**: Status = "Uploading" → File being uploaded to S3 bucket
2. **2s**: Status = "Queued" → Message sent to SQS queue
3. **4s**: Status = "Reviewing Content" → SQS Orchestrator picked up, LLM processing
4. **8s**: Status = "Completed" → LLM finished, result saved to S3, ready for viewing

#### Auto-Progression (Demo Feature)

Every 10 seconds, the system automatically progresses statuses:

- Uploading → Queued → Reviewing Content → Completed

This simulates real-time updates that would come from the backend.

### 3. Results Page Enhancements

#### New Information Displayed

**Document Details:**

- Document name
- Review date and time
- Status
- **S3 Result Location**: Shows where LLM results are stored
- **LLM Model**: GPT-4 Turbo
- **Processing Time**: 45 seconds

**Processing Workflow Table:**
Shows the complete workflow with timestamps:

1. Upload to S3 - Completed
2. Message to SQS Queue - Completed
3. SQS Orchestrator Processing - Completed
4. LLM Content Review - Completed
5. Save Results to S3 - Completed

**Enhanced Summary Statistics:**

- Overall Score: 85
- Readability: Good
- Compliance: Excellent
- Issues Found: 3
- Word Count: 2,450
- Average Sentence Length: 18 words

**AI-Enhanced Findings:**
Each finding now includes:

- Category (Readability, Formatting, GOV.UK Standards)
- Severity level (High/Medium/Low)
- **AI Confidence Score** (e.g., 92%, 88%, 95%)
- Detailed description
- Location in document
- Specific suggestions

**Comprehensive Recommendations:**
8 detailed recommendations including:

- Sentence length optimization
- Formatting consistency
- GOV.UK style guide compliance
- Accessibility improvements
- Active voice usage
- Alt text for images
- Descriptive links

### 4. Export Functionality (Placeholder)

Two export buttons available:

- **Export as PDF**: Will generate PDF report with all findings
- **Export as Word**: Will generate Word document with all findings

Currently shows placeholder alerts - ready for backend implementation.

## Workflow Architecture

### Current Flow (Simulated)

```
User Upload → S3 Bucket → SQS Queue → SQS Orchestrator → LLM Processing → S3 Results → Web UI
```

### Status Progression Timeline

```
Uploading (0-2s) → Queued (2-4s) → Reviewing Content (4-8s) → Completed (8s+)
```

### What Happens at Each Stage

1. **Uploading**: File is being transferred to S3 bucket
2. **Queued**:
   - File successfully uploaded to S3
   - Message with file metadata sent to SQS queue
   - Waiting for SQS Orchestrator to pick up
3. **Reviewing Content**:
   - SQS Orchestrator received the message
   - Document extracted and sent to LLM
   - LLM analyzing content for:
     - Readability
     - GOV.UK compliance
     - Accessibility
     - Formatting issues
     - Language clarity
4. **Completed**:
   - LLM finished analysis
   - Results saved to S3 bucket (JSON format)
   - Result available for viewing in Web UI
   - Export options enabled

## Sample LLM Output Structure

The results page displays mock data that represents what the LLM would return:

```json
{
  "id": "1001",
  "documentName": "GOV.UK_Service_Standards.pdf",
  "s3Location": "s3://dev-service-optimisation-c63f2/review-results/review-1001.json",
  "llmModel": "GPT-4 Turbo",
  "processingTime": "45 seconds",
  "summary": {
    "overallScore": 85,
    "readabilityScore": "Good",
    "complianceScore": "Excellent",
    "issuesFound": 3,
    "wordCount": 2450,
    "averageSentenceLength": 18,
    "complexWords": 145
  },
  "findings": [
    {
      "category": "Readability",
      "severity": "Medium",
      "description": "...",
      "location": "Page 2, Paragraph 3",
      "suggestion": "...",
      "aiConfidence": 0.92
    }
  ],
  "recommendations": [...]
}
```

## Testing the Implementation

### View Dummy Data

1. Navigate to http://localhost:3000
2. See 6 pre-populated records with various statuses
3. Watch statuses auto-progress every 10 seconds

### Submit New Content

1. Upload a file or enter text
2. Click "Review Content"
3. Watch the status progression:
   - Uploading (2 seconds)
   - Queued (2 seconds)
   - Reviewing Content (4 seconds)
   - Completed (ready)

### View Results

1. Click "View results" on any Completed item
2. See detailed review information including:
   - Workflow steps
   - Summary statistics
   - AI confidence scores
   - Detailed findings
   - Recommendations

### Test Export (Placeholder)

1. On results page, click "Export as PDF" or "Export as Word"
2. See placeholder alert (ready for backend integration)

## Next Steps for Production

### Backend Integration Required

1. **S3 Upload**
   - Implement actual file upload to S3 bucket
   - Generate unique file IDs
   - Store file metadata

2. **SQS Integration**
   - Send message to SQS queue after upload
   - Include file metadata and S3 location
   - Track message ID for status updates

3. **SQS Orchestrator**
   - Poll SQS queue for new messages
   - Extract documents from S3
   - Format content for LLM

4. **LLM Integration**
   - Send content to LLM (GPT-4, Claude, etc.)
   - Process LLM response
   - Save results to S3

5. **Status Updates**
   - Implement WebSocket or Server-Sent Events for real-time updates
   - Or use polling mechanism to check status

6. **Result Retrieval**
   - Fetch results from S3 when status is Completed
   - Parse JSON and display in UI

7. **Export Implementation**
   - PDF generation using puppeteer or pdfkit
   - Word document generation using docx library
   - Download endpoints

## File Changes Summary

### Modified Files:

- `src/server/home/index.njk`
  - Added 6 dummy records
  - Changed "Actions" to "Result"
  - Added workflow-specific status messages
  - Implemented auto-progression timer
  - Updated form handling

- `src/server/review/results/controller.js`
  - Enhanced mock data with workflow steps
  - Added S3 location, LLM model info
  - Added AI confidence scores
  - More detailed statistics

- `src/server/review/results/index.njk`
  - Added workflow steps table
  - Enhanced summary with more metrics
  - Added AI confidence to findings
  - Improved layout

### Status Colors:

- 🔵 Blue (Uploading): File uploading to S3
- 🟡 Yellow (Queued): In SQS queue
- 🟣 Purple (Reviewing Content): LLM processing
- 🟢 Green (Completed): Results ready
- 🔴 Red (Failed): Error occurred

This implementation provides a complete visualization of the entire workflow from upload to LLM processing and result display.
