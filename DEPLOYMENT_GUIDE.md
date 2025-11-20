# Deployment Guide - Modernized Field Trip Application

## 🎯 Overview

This guide will help you deploy the modernized field trip application to your DEV environment for testing, and eventually to production.

---

## 📋 Pre-Deployment Checklist

### 1. Verify Your Environment
```bash
# Make sure you're on the dev branch
git branch

# Make sure you're pointing to DEV environment
./switch-env.sh

# Should show DEV script ID: ...P2pF
```

### 2. Review Files to Deploy

**New Core Files** (must deploy):
- ✅ `Config.js` - Form schema and configuration
- ✅ `DataLayer.js` - Flexible column mapping system
- ✅ `ValidationUtils.js` - Input sanitization and validation
- ✅ `FormHandlers.js` - Modern form submission handlers
- ✅ `EmailService.js` - Email notifications
- ✅ `FormNew.html` - New main form interface
- ✅ `BuildingAdminNew.html` - Building admin approval interface
- ✅ `DistrictAdminNew.html` - District admin approval interface
- ✅ `CodeNew.js` - Updated routing logic

**Keep for Backward Compatibility** (optional):
- `Code.js` - Old routing (can keep as backup)
- `forms.html` - Old form (keep as backup)
- `buildAdmin.html` - Old building admin (keep as backup)
- `districtAdmin.html` - Old district admin (keep as backup)
- `Merge.js`, `PreMerge.js`, `CalendarAdd.js` - Supporting functions

---

## 🚀 Deployment Steps

### Step 1: Push to DEV Apps Script

```bash
# Ensure you're in dev environment
./switch-env.sh dev

# Push all files to DEV Apps Script project
clasp push

# This will upload all .js and .html files
```

### Step 2: Update Spreadsheet Structure

The new system will auto-create missing columns, but you should verify:

1. Open your "Field Trip Form - DEV 2025" spreadsheet
2. Go to the "Submissions" sheet
3. The system will add these column headers (if missing):
   - Submission_Number
   - Timestamp
   - Status
   - Trip_Date
   - Day_of_Week
   - Building
   - Destination
   - Teacher_Adult_in_Charge
   - Email
   - Phone_Number
   - Grade_Level
   - Number_of_Students
   - Number_of_Adults
   - Leave_School
   - Arrive_Destination
   - Leave_Destination
   - Arrive_School
   - Transportation
   - Transportation_Other
   - Purpose
   - Curriculum_Connection
   - Cost_Per_Student
   - Funding_Source
   - Building_Admin
   - Building_Comments
   - Building_Approval_Date
   - District_Comments
   - District_Approval_Date
   - Approval_Document_URL

4. Repeat for "Completed" sheet

**Note**: The system auto-creates columns, so this is just for verification.

### Step 3: Verify Settings Sheet

Ensure your `_Settings` sheet has these entries:

| Setting Key | Value |
|------------|-------|
| HS_ADMIN | High School Admin Name |
| HS_EMAIL | hs.admin@ofcs.net |
| MS_ADMIN | Middle School Admin Name |
| MS_EMAIL | ms.admin@ofcs.net |
| IS_ADMIN | Intermediate School Admin Name |
| IS_EMAIL | is.admin@ofcs.net |
| FL_ADMIN | Florence Lawson Admin Name |
| FL_EMAIL | fl.admin@ofcs.net |
| ECC_ADMIN | ECC Admin Name |
| ECC_EMAIL | ecc.admin@ofcs.net |
| DISTRICT_EMAIL | district.admin@ofcs.net |
| BUS_GARAGE_EMAIL | busgarage@ofcs.net |
| SPREADSHEET_ID | (your spreadsheet ID) |
| INITIAL_SUB_FOLDER_ID | (Google Drive folder for initial PDFs) |
| DESTINATION_FOLDER_ID | (Google Drive folder for approved PDFs) |
| TEMPLATE_INIT_ID | (Google Doc template for initial submission) |
| TEMPLATE_ID | (Google Doc template for approval) |
| CALENDAR_ID | (Google Calendar ID - optional) |

### Step 4: Update Code.js to Use New System

**Option A: Gradual Migration (Recommended for Testing)**

1. Keep both `Code.js` and `CodeNew.js`
2. In `Code.js`, change line 14-52 (the doGet function) to:

```javascript
function doGet(e) {
  // Use new routing temporarily - can be reverted easily
  var buildingApproved = e.parameter.buildapprove;
  var idVal = e.parameter.idNum;
  var template;

  try {
    if (buildingApproved == 2) {
      var submission = findSubmission(idVal);
      if (!submission) {
        return ContentService.createTextOutput("Submission not found or already processed.");
      }
      template = HtmlService.createTemplateFromFile("DistrictAdminNew.html");
      template.info = submission.dataObject;

    } else if (buildingApproved == 1) {
      var submission = findSubmission(idVal);
      if (!submission) {
        template = HtmlService.createTemplateFromFile("DoneAlready.html");
      } else {
        template = HtmlService.createTemplateFromFile("BuildingAdminNew.html");
        template.info = submission.dataObject;
      }

    } else if (buildingApproved == 0) {
      updateSubmission(idVal, { status: STATUS_VALUES.REJECTED });
      return ContentService.createTextOutput("Application rejected!");

    } else {
      template = HtmlService.createTemplateFromFile("FormNew.html");
    }

    var html = template.evaluate();
    return HtmlService.createHtmlOutput(html).setTitle("OFCS Field Trip Application");

  } catch (error) {
    Logger.log('doGet error: ' + error);
    return ContentService.createTextOutput("An error occurred. Please try again.");
  }
}
```

**Option B: Complete Replacement**

Simply replace the content of `Code.js` with `CodeNew.js` content.

### Step 5: Deploy Web App

1. In Apps Script Editor, click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Description: "Modernized Field Trip Form - DEV Testing"
4. Execute as: **Me**
5. Who has access: **Anyone** (or your preference)
6. Click **Deploy**
7. Copy the **Web app URL**

---

## 🧪 Testing Workflow

### Test 1: Form Submission

1. Open the web app URL
2. Fill out the form with test data
3. Test validation by:
   - Leaving required fields blank → Should show errors
   - Enter invalid email → Should show error
   - Enter past date → Should show error
   - Enter invalid phone → Should show error
4. Click "Save Draft" → Should save to localStorage
5. Refresh page → Should prompt to load draft
6. Submit the form
7. Verify:
   - ✅ Success message appears
   - ✅ Data appears in "Submissions" sheet
   - ✅ Status is "Pending Building Approval"
   - ✅ Submission number is generated
   - ✅ Building admin receives email
   - ✅ Submitter receives confirmation email

### Test 2: Building Admin Approval

1. Check building admin email
2. Click the approval link
3. Verify:
   - ✅ All form data displays correctly
   - ✅ Can add comments
   - ✅ Can approve or reject
4. Click "Approve & Forward"
5. Verify:
   - ✅ Success message appears
   - ✅ Status changes to "Pending District Approval"
   - ✅ District admin receives email
   - ✅ Building comments saved

### Test 3: District Admin Approval

1. Check district admin email
2. Click the approval link
3. Verify:
   - ✅ All form data displays correctly
   - ✅ Building admin comments show
   - ✅ Can add comments
   - ✅ Can approve or reject
4. Click "Final Approval"
5. Verify:
   - ✅ Success message appears
   - ✅ Row moves to "Completed" sheet
   - ✅ Status is "Approved"
   - ✅ Submitter receives approval email
   - ✅ PDF document generated (if templates configured)
   - ✅ Bus garage notified (if transportation is bus)

### Test 4: Rejection Flow

Test rejecting at both building and district levels:
1. Submit a test form
2. Building admin rejects with comments
3. Verify submitter receives rejection email with comments

---

## 🔍 Troubleshooting

### Form Won't Submit
- Check browser console for errors (F12)
- Verify all required fields are filled
- Check that Apps Script project is deployed
- Verify `submitFieldTripForm` function exists

### Emails Not Sending
- Check Execution log in Apps Script
- Verify email addresses in `_Settings` sheet
- Check quota limits (MailApp has daily limits)
- Verify MailApp permissions granted

### Data Not Saving
- Check `ensureColumnsExist()` ran successfully
- Verify spreadsheet permissions
- Check Execution log for errors
- Ensure sheet names are correct ("Submissions", "Completed")

### Admin Links Don't Work
- Verify web app deployment
- Check that `findSubmission()` is working
- Ensure submission number is valid
- Check Execution log

---

## 📊 Monitoring & Logs

### View Execution Logs
1. Open Apps Script Editor
2. Click **Executions** (left sidebar)
3. View recent runs and errors

### Common Log Messages
- `Added X missing columns` - Normal, system auto-created columns
- `Submission not found` - Invalid or already processed submission
- `PDF generation error` - Template or folder issue (non-critical)
- `Calendar add error` - Calendar integration issue (non-critical)

---

## 🔄 Rollback Plan

If issues arise, you can quickly rollback:

### Quick Rollback (Routing Only)
In `Code.js`, change the template file names back to originals:
- `FormNew.html` → `forms.html`
- `BuildingAdminNew.html` → `buildAdmin.html`
- `DistrictAdminNew.html` → `districtAdmin.html`

Then `clasp push` to redeploy.

### Full Rollback (Git)
```bash
# Checkout previous commit
git checkout <previous-commit-hash>

# Push to Apps Script
clasp push

# Force deploy
```

---

## ✅ Production Deployment

Once DEV testing is complete:

1. **Merge to Master**
   ```bash
   git checkout master
   git merge dev
   git push origin master
   ```

2. **Switch to Production**
   ```bash
   ./switch-env.sh prod
   ```

3. **Deploy to Production Apps Script**
   ```bash
   clasp push
   ```

4. **Create New Web App Deployment**
   - Deploy as new version in Apps Script
   - Update any bookmarks/links with new URL

5. **Communicate with Staff**
   - Send email about new interface
   - Provide training if needed
   - Share new web app URL

---

## 📝 Post-Deployment

### Monitor for First Week
- Check daily execution logs
- Monitor email delivery
- Watch for user feedback
- Track submission success rate

### Gather Feedback
- Survey staff about new interface
- Note any bugs or issues
- Track performance improvements

### Future Enhancements
- Add more conditional fields if needed
- Enhance email templates
- Add reporting dashboard
- Implement user authentication

---

## 🆘 Support

If you encounter issues:
1. Check this deployment guide
2. Review execution logs in Apps Script
3. Check GitHub issues
4. Test in isolation (one function at a time)

---

**Good luck with your deployment!** 🚀

The new system is significantly more robust, secure, and maintainable than the original. Take time to test thoroughly in DEV before moving to production.
