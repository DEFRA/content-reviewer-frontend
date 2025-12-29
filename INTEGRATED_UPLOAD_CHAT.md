# Integrated Upload & Chat Feature

## Overview

The upload functionality has been fully integrated into the chat interface, providing users with a seamless experience where they can:

1. **Type or paste content** directly in the chat for review
2. **Upload PDF or Word documents** from the same page

## What Changed

### ✅ User Interface Integration

#### Before:

- Upload was on a separate page (`/upload`)
- Users had to navigate away from chat to upload documents
- Separate success/error pages

#### After:

- Upload option is embedded in the chat interface
- Users can choose between typing content or uploading a document
- Success/error messages appear as notifications on the same page
- Seamless workflow without leaving the chat

### 📁 Modified Files

1. **`src/server/home/index.njk`**
   - Added collapsible upload section with GOV.UK Details component
   - Added success/error notification banners
   - Added visual divider between upload and chat input
   - Updated welcome message to mention both options

2. **`src/server/home/controller.js`**
   - Added flash message handling for upload success/error
   - Passes upload status to view

3. **`src/server/upload/controller.js`**
   - Modified `uploadComplete()` to redirect to home (`/`) instead of separate pages
   - Stores success/error messages in session flash
   - Maintains upload status across redirects

4. **`src/client/stylesheets/components/_chat.scss`**
   - Added `.upload-option-card` styling with light grey background
   - Added `.upload-icon` SVG styling
   - Added `.divider-with-text` for visual separation
   - Added success notification banner styling
   - Enhanced GOV.UK Details component styling

## 🎨 Visual Design

### Upload Section Features:

- **Collapsible Details Component**: Uses GOV.UK's native details/summary element
- **Upload Icon**: Clean SVG icon for visual recognition
- **Information Table**: Shows accepted formats, size limits, and security features
- **Primary Action Button**: "Choose and Upload Document" button
- **Visual Divider**: "or type your message below" separator

### Notification System:

- **Success Banner**: Green notification with file details (name, size, ID, location)
- **Error Banner**: Red error summary with specific error message
- **Auto-dismiss**: Messages are session-based and clear after display

## 🔄 User Flow

### Uploading a Document:

```
1. User on home page (chat interface)
   ↓
2. Expands "Upload a document" section
   ↓
3. Clicks "Choose and Upload Document"
   ↓
4. Redirected to CDP Uploader (localhost:7337)
   ↓
5. Selects file and uploads
   ↓
6. CDP Uploader scans file
   ↓
7. Redirected back to status poller
   ↓
8. JavaScript polls for completion
   ↓
9. Redirected to home page
   ↓
10. Green success banner shows file details
    ↓
11. User can continue chatting or upload another file
```

### Error Handling:

```
1. If upload fails (virus, size, format, etc.)
   ↓
2. User redirected to home page
   ↓
3. Red error banner shows specific error message
   ↓
4. User can try again immediately
```

## 📊 Features Overview

| Feature                  | Description                                        |
| ------------------------ | -------------------------------------------------- |
| **Dual Input Methods**   | Chat text input + document upload                  |
| **Seamless Integration** | Both options on same page                          |
| **Visual Clarity**       | Clear separation with styled components            |
| **Feedback System**      | Success/error notifications                        |
| **Session Management**   | Flash messages for cross-page communication        |
| **Accessibility**        | GOV.UK compliant, ARIA labels, keyboard navigation |
| **Responsive Design**    | Works on all device sizes                          |

## 🎯 Key Improvements

✨ **Better UX**: No need to switch pages for different input methods  
✨ **Clear Options**: Visual hierarchy shows both methods clearly  
✨ **Instant Feedback**: Success/error messages on the same screen  
✨ **Consistent Design**: Uses GOV.UK Design System throughout  
✨ **Mobile Friendly**: Collapsible section saves space on mobile  
✨ **Accessible**: Follows GOV.UK accessibility standards

## 🔧 Technical Implementation

### Session Flash Messages

```javascript
// In upload controller
request.yar.flash('uploadSuccess', {
  filename: fileDetails.filename,
  size: fileDetails.contentLength
  // ... other details
})

// In home controller
const uploadSuccess = request.yar.flash('uploadSuccess')
```

### Collapsible Upload Section

```html
<details class="govuk-details">
  <summary class="govuk-details__summary">
    <svg><!-- Upload icon --></svg>
    Upload a document for review
  </summary>
  <div class="govuk-details__text">
    <!-- Upload form and details -->
  </div>
</details>
```

### Success Notification

```html
<div class="govuk-notification-banner govuk-notification-banner--success">
  <div class="govuk-notification-banner__header">
    <h2>Success</h2>
  </div>
  <div class="govuk-notification-banner__content">
    <!-- File details -->
  </div>
</div>
```

## 📝 Usage Examples

### For Users:

**Option 1: Type/Paste Content**

1. Type or paste content in the text area
2. Click "Send"
3. Get immediate feedback in chat

**Option 2: Upload Document**

1. Click "Upload a document for review" to expand
2. Review file requirements
3. Click "Choose and Upload Document"
4. Select PDF or Word file
5. Wait for processing
6. See success message with file details

### For Developers:

The integration maintains separation of concerns:

- Upload logic remains in `/upload` routes
- Home page handles display and flash messages
- Session management bridges the two

## 🔒 Security & Validation

- ✅ File type validation (PDF, DOC, DOCX only)
- ✅ Size limit enforcement (10MB max)
- ✅ Virus scanning via CDP Uploader
- ✅ Session-based tracking
- ✅ Server-side validation

## 🚀 Current Status

✅ **Integration Complete**  
✅ **Styling Applied**  
✅ **Flash Messages Working**  
✅ **Notifications Displaying**  
✅ **Responsive Design**  
✅ **Accessibility Compliant**

## 📚 Routes

| Route                       | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `GET /`                     | Home page with integrated chat + upload |
| `POST /upload/initiate`     | Start upload process                    |
| `GET /upload/status-poller` | Poll upload status                      |
| `GET /upload/complete`      | Process completion, redirect to home    |

## 🎉 Result

Users now have a unified interface where they can:

- Chat with the AI assistant
- Upload documents for review
- See results in one place
- Switch between methods seamlessly

All without leaving the main page!

---

**Last Updated**: December 29, 2025  
**Status**: ✅ Production Ready
