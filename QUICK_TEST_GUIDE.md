# Quick Reference - Review Results Export & Debug

## 🎯 What Changed?

### ✅ For End Users:

1. **Processing Workflow** section **REMOVED** from results page
2. **Export buttons** added:
   - Export as PDF
   - Export as Word

### ✅ For Backend Users/Developers:

1. **Debug view** created at `/review/debug/{id}`
2. Processing workflow moved to debug endpoint
3. Access via expandable "Backend/Developer Options" section

---

## 🚀 How to Test

### Test 1: View Results (User View)

```
http://localhost:3000/review/results/1001
```

**Expected:**

- ✅ No workflow section visible
- ✅ Two export buttons at top
- ✅ Findings and recommendations displayed
- ✅ "Backend/Developer Options" at bottom

### Test 2: Export as PDF

1. Click **"Export as PDF"** button
2. File downloads: `review-results-1001.pdf`
3. Open PDF - verify all findings are included

### Test 3: Export as Word

1. Click **"Export as Word"** button
2. File downloads: `review-results-1001.docx`
3. Open Word doc - verify formatting is correct

### Test 4: Debug View (Backend Users)

```
http://localhost:3000/review/debug/1001
```

**Expected:**

- ✅ Warning message: "This is a debug view for backend users"
- ✅ Complete workflow table with 5 steps
- ✅ Timestamps for each step
- ✅ Technical details in JSON format

---

## 📂 Available Review IDs for Testing

- **1001** - GOV.UK_Service_Standards.pdf (3 findings)
- **1005** - Policy_Update_Jan2026.pdf (2 findings)
- **Any other ID** - Uses default dummy data (4 findings)

---

## 🔗 Quick Links

| Purpose              | URL                                           |
| -------------------- | --------------------------------------------- |
| Home Page            | http://localhost:3000                         |
| Results (User View)  | http://localhost:3000/review/results/1001     |
| Debug View (Backend) | http://localhost:3000/review/debug/1001       |
| Export PDF           | http://localhost:3000/review/export/1001/pdf  |
| Export Word          | http://localhost:3000/review/export/1001/word |

---

## 💡 Key Features

### Export PDF:

- Professional PDF layout
- All findings with severity indicators
- AI confidence scores
- Recommendations
- Report ID and timestamp

### Export Word:

- Editable .docx format
- Formatted with headings and bold text
- Color-coded severity levels
- Numbered recommendations
- Can be edited and shared

### Debug View:

- Only for backend users/developers
- Complete processing workflow
- Step-by-step timestamps
- Technical JSON details
- Not visible to end users

---

## 🛠️ Server Status

Check all services are running:

```powershell
# Frontend (should be port 3000)
netstat -ano | findstr ':3000'

# Backend (should be port 3001)
netstat -ano | findstr ':3001'

# LocalStack (should be port 4566)
netstat -ano | findstr ':4566'
```

---

## 📝 Notes

- Export functionality uses `pdfkit` and `docx` npm packages
- Debug view is accessed via expandable section (hidden by default)
- Workflow data is still available in logs and debug endpoint
- End users only see relevant review information
