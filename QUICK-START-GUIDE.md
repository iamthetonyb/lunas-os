# 🚀 LUNAS OS - Quick Start Guide

## ✅ Current Status
**Your server is running and stable!**
- URL: http://localhost:4010
- Status: ✅ All systems operational
- Database: ✅ Connected

---

## 🎯 What's New

### Google Sheets Import Support
You can now import data directly from Google Sheets URLs in addition to CSV and Excel files!

### Enhanced UI/UX
All buttons now have modern icons, loading states, and better visual feedback throughout the app.

---

## 🖥️ Using Your Application

### Access the Application
1. Open your browser
2. Go to: **http://localhost:4010**
3. Login with: `dispatcher@lunas.com` / `password`

### Navigate to Contracts Page
- Click "Contracts & Configuration" in the sidebar
- You'll see three tabs:
  - 🛠️ **Services** - Manage service types
  - 🏠 **Model Plans** - Configure house models
  - 💵 **Rates** - Set pricing

### Import Data

#### Method 1: Upload File (CSV/Excel)
1. Click the file input button
2. Select your .csv, .xlsx, or .xls file
3. Click "Parse File"
4. Map columns to database fields
5. Click "Import"

#### Method 2: Google Sheets
1. Make your Google Sheet public (Share > Anyone with link can view)
2. Copy the sheet URL (e.g., `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`)
3. Paste into the "Import from Google Sheets" field
4. Click "Import from Sheets"
5. Map columns if needed
6. Confirm import

---

## 🛠️ Server Commands

### Start Server
```bash
cd /Users/abenton333/LUNAS-OS
pnpm dev
```

### Stop Server
Press `Ctrl+C` in the terminal

### Restart with Clean Cache
```bash
rm -rf .next
pnpm dev
```

### Run Linter
```bash
pnpm lint
```

---

## 🔧 Troubleshooting

### If Browser Shows Old/Broken Interface
1. **Clear browser cache** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. **Hard reload** the page
3. If still broken, close all browser tabs and reopen

### If Server Won't Start
1. Make sure port 4010 is not in use:
   ```bash
   lsof -i :4010
   ```
2. Kill any existing process if needed
3. Restart the server

### If Database Connection Fails
1. Check PostgreSQL is running:
   ```bash
   pg_isready -h localhost -p 5432
   ```
2. If not running, start it or use Docker:
   ```bash
   docker-compose up -d
   ```

---

## 📝 Important Notes

### Browser Compatibility
- **Recommended:** Chrome, Firefox, Safari (latest versions)
- Make sure JavaScript is enabled
- Clear cache if interface looks broken

### Google Sheets Import
- Sheet MUST be public or shared with "Anyone with link can view"
- Private sheets will fail to import
- Large sheets may take a few seconds to process

### Data Safety
- All imports are validated before saving
- You can review mapped columns before importing
- Database has transaction rollback on errors

---

## 🎨 UI/UX Features

### Button Indicators
- **Blue buttons** = Primary actions (Add, Edit, Save)
- **Green buttons** = Import/Success actions
- **Red buttons** = Delete/Destructive actions
- All buttons show spinners when processing

### Visual Feedback
- Loading spinners during operations
- Success/error messages after actions
- Color-coded status indicators
- Hover effects on interactive elements

---

## ✅ System Health Checklist

Before reporting issues, verify:
- [ ] Server is running (check terminal)
- [ ] Browser cache is cleared
- [ ] Using latest browser version
- [ ] Database is connected
- [ ] No console errors (F12 > Console tab)

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| Server URL | http://localhost:4010 |
| Port | 4010 |
| Database | PostgreSQL @ localhost:5432 |
| Login | dispatcher@lunas.com |
| Password | password |
| Node Version | v24.5.0 |
| React Version | 19.0.0 |
| Next.js Version | 15.5.5 |

---

## 🎯 Common Tasks

### Add a New Service
1. Go to Contracts > Services tab
2. Click "Add Service" (blue button with + icon)
3. Fill in the form
4. Click "Save"

### Edit a Service
1. Find the service in the table
2. Click "Edit" button (blue with pencil icon)
3. Modify fields
4. Click "Update"

### Delete a Service
1. Find the service in the table
2. Click "Delete" button (red with trash icon)
3. Confirm deletion
4. Service will be removed

---

**Everything is ready to go! Your application is stable and fully functional.** 🎉

If you encounter any issues:
1. Check the terminal for server errors
2. Check browser console (F12) for client errors
3. Clear browser cache and reload
4. Restart the server if needed

Happy building! 🚀
