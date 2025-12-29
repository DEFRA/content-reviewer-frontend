# Document Upload Feature

This module implements PDF and Word document upload functionality using the CDP Uploader service.

## Overview

The upload feature allows users to upload PDF and Word documents which are:

1. Scanned for viruses using CDP Uploader
2. Stored securely in S3
3. Made available for content review

## Architecture

### Flow Diagram

```
User → Frontend → CDP Uploader → S3 Storage
  ↓         ↓           ↓
Upload   Initiate    Scan
  ↓         ↓           ↓
Status   Poll      Complete
  ↓         ↓           ↓
Success  Display   Callback
```

### Components

1. **Configuration** (`src/config/config.js`)
   - CDP Uploader URL
   - S3 bucket settings
   - File size limits
   - Allowed MIME types

2. **Client Service** (`src/server/common/helpers/cdp-uploader-client.js`)
   - `initiateUpload()` - Start upload session
   - `getUploadStatus()` - Check upload status
   - `pollUploadStatus()` - Poll until complete

3. **Controller** (`src/server/upload/controller.js`)
   - `showUploadForm` - Display upload form
   - `initiateUpload` - Start upload process
   - `statusPoller` - Poll upload status
   - `getStatus` - API endpoint for status
   - `uploadComplete` - Handle completion
   - `handleCallback` - Process CDP callback

4. **Routes** (`src/server/upload/index.js`)
   - `GET /upload` - Upload form
   - `POST /upload/initiate` - Start upload
   - `GET /upload/status-poller` - Status polling page
   - `GET /upload/status/{uploadId}` - Status API
   - `GET /upload/complete` - Completion page
   - `POST /upload/callback` - CDP callback endpoint

5. **Views**
   - `index.njk` - Upload form
   - `status-poller.njk` - Status polling page (with JavaScript)
   - `success.njk` - Upload success page
   - `error.njk` - Upload error page

## API Integration

### CDP Uploader API

#### 1. Initiate Upload

```javascript
POST {cdpUploaderUrl}/initiate

Body:
{
  "redirect": "https://your-service/upload/status-poller",
  "callback": "https://your-service/upload/callback",
  "s3Bucket": "my-bucket",
  "s3Path": "content-uploads",
  "metadata": {
    "userId": "user123",
    "timestamp": "2025-12-29T10:00:00Z"
  },
  "mimeTypes": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  "maxFileSize": 10000000
}

Response:
{
  "uploadId": "b18ceadb-afb1-4955-a70b-256bf94444d5",
  "uploadUrl": "/upload-and-scan/b18ceadb-afb1-4955-a70b-256bf94444d5",
  "statusUrl": "https://cdp-uploader/status/b18ceadb-afb1-4955-a70b-256bf94444d5"
}
```

#### 2. Check Status

```javascript
GET {cdpUploaderUrl}/status/{uploadId}

Response:
{
  "uploadStatus": "ready|pending|rejected",
  "metadata": { ... },
  "form": {
    "file": {
      "fileId": "uuid",
      "filename": "document.pdf",
      "contentType": "application/pdf",
      "fileStatus": "complete|rejected|pending",
      "contentLength": 204800,
      "s3Bucket": "my-bucket",
      "s3Key": "content-uploads/uploadId/fileId",
      "hasError": false,
      "errorMessage": null
    }
  },
  "numberOfRejectedFiles": 0
}
```

## Configuration

### Environment Variables

```bash
# CDP Uploader Configuration
CDP_UPLOADER_URL=http://localhost:7337
CDP_UPLOADER_S3_BUCKET=my-bucket
CDP_UPLOADER_S3_PATH=content-uploads
CDP_UPLOADER_MAX_FILE_SIZE=10000000
CDP_UPLOADER_MIME_TYPES=application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

### Default Configuration

- **CDP Uploader URL**: `http://localhost:7337` (local development)
- **S3 Bucket**: `my-bucket`
- **S3 Path**: `content-uploads`
- **Max File Size**: 10MB (10,000,000 bytes)
- **Allowed Types**: PDF (.pdf), Word (.doc, .docx)

## Usage

### User Journey

1. **Upload Page** (`/upload`)
   - User clicks "Start Upload" button
   - Form submits to `/upload/initiate`

2. **Initiate Upload**
   - Backend calls CDP Uploader `/initiate` endpoint
   - Gets `uploadId` and `uploadUrl`
   - Redirects user to CDP Uploader's upload form

3. **CDP Uploader**
   - User selects and uploads file
   - CDP Uploader scans for viruses
   - Redirects back to `/upload/status-poller`

4. **Status Polling**
   - JavaScript polls `/upload/status/{uploadId}` every 2 seconds
   - Shows processing status
   - Redirects to `/upload/complete` when ready

5. **Completion**
   - Shows file details
   - Displays S3 location
   - Offers to upload another file

### Error Handling

The upload can fail for several reasons:

- **Virus detected**: File contains malware
- **File too large**: Exceeds 10MB limit
- **Invalid type**: Not PDF or Word document
- **Empty file**: File has no content
- **Server error**: CDP Uploader or S3 issues

All errors are displayed with user-friendly messages based on GOV.UK guidelines.

## Development

### Running Locally

1. **Start CDP Uploader**

   ```bash
   # Using Docker Compose (recommended)
   docker compose up cdp-uploader

   # Or clone and run locally
   git clone https://github.com/DEFRA/cdp-uploader.git
   cd cdp-uploader
   npm install
   npm run dev
   ```

2. **Configure Environment**

   ```bash
   export CDP_UPLOADER_URL=http://localhost:7337
   export CDP_UPLOADER_S3_BUCKET=my-bucket
   ```

3. **Start Frontend**

   ```bash
   npm run dev
   ```

4. **Access Upload Page**
   ```
   http://localhost:3000/upload
   ```

### Testing

Mock virus scanning is enabled by default in local development. Files containing "virus" in the filename will be flagged as infected.

### Debugging

Enable debug mode for status endpoint:

```javascript
const status = await getUploadStatus(uploadId, true)
// Returns additional debug information
```

## Security Considerations

1. **Virus Scanning**: All files are scanned before storage
2. **File Type Validation**: Only PDF and Word documents accepted
3. **Size Limits**: 10MB maximum file size
4. **Session Security**: Upload IDs stored in secure server-side sessions
5. **HTTPS Required**: Production requires secure connections

## Future Enhancements

- [ ] Multiple file upload support
- [ ] Drag-and-drop interface
- [ ] Upload progress indicator
- [ ] File preview before upload
- [ ] Integration with content review backend
- [ ] Support for additional file types
- [ ] Batch upload processing

## Troubleshooting

### Common Issues

**"Failed to initiate upload"**

- Check CDP Uploader is running
- Verify `CDP_UPLOADER_URL` is correct
- Check network connectivity

**"Upload processing timed out"**

- Increase `maxAttempts` or `pollInterval`
- Check CDP Uploader logs
- Verify S3 bucket permissions

**"File was rejected"**

- Check file type is PDF or Word
- Ensure file size is under 10MB
- Verify file is not corrupted
- Check for viruses

## References

- [CDP Uploader Documentation](https://github.com/DEFRA/cdp-uploader)
- [GOV.UK File Upload Guidelines](https://design-system.service.gov.uk/components/file-upload/)
- [GOV.UK Design System](https://design-system.service.gov.uk/)
