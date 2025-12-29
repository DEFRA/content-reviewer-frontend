# Quick Start Guide - Content Reviewer with Upload

## ✅ What's Working

Your application is **fully functional** with both chat and upload features integrated on the same page!

## 🚀 Accessing the Application

### URL

```
http://localhost:3000
```

### What You'll See

1. **Left Sidebar** - Conversation history and "New chat" button
2. **Main Chat Area** - Welcome message and chat interface
3. **Upload Section** - Collapsible "Upload a document for review" option
4. **Chat Input** - Text area to type messages

## 📤 Using the Upload Feature

### Step-by-Step:

1. Open http://localhost:3000 in your browser
2. Look for the section "Upload a document for review" (it's a collapsible section)
3. Click to expand it
4. Read the requirements:
   - **Formats:** PDF (.pdf), Word (.doc, .docx)
   - **Max Size:** 10MB
   - **Security:** Files are virus-scanned
5. Click "Choose and Upload Document" button
6. Select your file
7. Wait for upload and scanning to complete
8. You'll be redirected back to the chat page with a success notification

### Success Notification

After successful upload, you'll see a green banner showing:

- ✅ "Document uploaded successfully"
- Filename and size
- File ID
- S3 storage location

### Error Handling

If upload fails, you'll see a red error banner with details about what went wrong.

## 💬 Using the Chat Feature

1. Type your message in the text area at the bottom
2. Click "Send" button
3. Messages appear in the chat area
4. Bot responses appear with blue left border
5. Your messages appear on the right with blue background

## 🔄 Workflow Examples

### Example 1: Upload Document Then Chat

```
1. Visit http://localhost:3000
2. Expand "Upload a document for review"
3. Upload a PDF
4. See success message
5. Type: "Can you summarize this document?"
6. Continue conversation
```

### Example 2: Chat Then Upload

```
1. Visit http://localhost:3000
2. Type: "I need help reviewing a document"
3. Bot may suggest uploading
4. Expand upload section
5. Upload your document
6. Continue chatting about it
```

## 🛠️ Running the Application

### Frontend (Port 3000)

If not already running:

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-frontend"
npm run dev
```

### Backend (Port 3001)

If not already running:

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\content-reviewer-backend"
npm start
```

### CDP Uploader (Port 3009)

If not already running:

```powershell
cd "c:\Users\2065580\OneDrive - Cognizant\DEFRA\Service Optimisation\AI Content Review\cdp-uploader"
npm run dev
```

## 📋 Feature Checklist

### ✅ Completed Features

- [x] Chat interface with conversation history
- [x] Upload form integrated on main chat page
- [x] Upload to CDP Uploader API
- [x] Virus scanning via ClamAV
- [x] S3 storage integration
- [x] Success/error notifications
- [x] Session-based flash messages
- [x] GOV.UK Design System styling
- [x] Responsive design (mobile-friendly)
- [x] Accessibility features (ARIA, keyboard navigation)
- [x] File type validation (PDF, Word)
- [x] File size validation (10MB max)

## 🎨 Design Features

### GOV.UK Compliance

- ✅ GOV.UK Design System components
- ✅ Proper heading hierarchy
- ✅ Accessible forms
- ✅ Color contrast meets WCAG AA
- ✅ Responsive grid layout
- ✅ Notification banners
- ✅ Details/Summary disclosure

### User Experience

- ✅ Collapsible upload section (doesn't clutter chat)
- ✅ Visual divider ("or type your message below")
- ✅ Upload icon (SVG)
- ✅ Clear requirements display
- ✅ Success/error feedback
- ✅ Persistent notifications
- ✅ No page refresh during chat

## 🔍 Troubleshooting

### Upload Not Working?

1. Check CDP Uploader is running on port 3009
2. Check S3/LocalStack configuration
3. Check file meets requirements (PDF/Word, under 10MB)
4. Check browser console for errors

### Chat Not Working?

1. Check backend is running on port 3001
2. Check browser console for JavaScript errors
3. Clear browser cache and refresh

### Styling Issues?

1. Check webpack compilation succeeded
2. Run `npm run dev` to rebuild assets
3. Hard refresh browser (Ctrl+Shift+R)

## 📚 Documentation

- **Full Upload Documentation:** `UPLOAD_FEATURE_SUMMARY.md`
- **Integration Details:** `INTEGRATED_UPLOAD_CHAT.md`
- **Upload Module README:** `src/server/upload/README.md`

## 🎯 Next Steps (Optional Enhancements)

Consider adding:

1. **Drag & Drop** - Drag files onto the page to upload
2. **Upload Progress Bar** - Real-time upload progress
3. **File Preview** - Preview uploaded PDFs in-browser
4. **Multiple Files** - Batch upload support
5. **Chat History Persistence** - Save conversations to database
6. **Document Reference** - Tag chat messages with uploaded files
7. **File Management** - View and manage uploaded files

## ✨ Summary

**You now have a fully integrated content review application with:**

- Single-page chat and upload interface
- GOV.UK Design System styling
- Secure file upload with virus scanning
- S3 storage integration
- User-friendly notifications
- Accessible and responsive design

**Everything is working and ready to use!** 🎉

Open http://localhost:3000 and start reviewing content!
