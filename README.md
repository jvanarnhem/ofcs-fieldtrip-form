# OFCS Field Trip Form

A Google Apps Script web application bound to a Google Spreadsheet for managing field trip form submissions and approvals for the district.

## 📋 Project Structure

- **Production Spreadsheet**: Field Trip Form (Live)
- **Development Spreadsheet**: Field Trip Form - DEV 2025
- **Version Control**: GitHub repository with branch-based workflow

## 🚀 Development Workflow

### Git Branch Strategy

- `master` branch → Production environment (LIVE)
- `dev` branch → Development/testing environment

### Environment Setup

This project uses CLASP to manage two separate Apps Script projects:

1. **Production** - The live, deployed application
2. **Development** - Your testing environment with a copy of the spreadsheet

## 🔧 Working with Environments

### Switch Between Environments

Use the helper script to switch between production and dev:

```bash
# Switch to DEVELOPMENT (safe for testing)
./switch-env.sh dev

# Switch to PRODUCTION (⚠️ affects live app!)
./switch-env.sh prod

# Check current environment
./switch-env.sh
```

### Configuration Files

- [.clasp.dev.json](.clasp.dev.json) - Development Apps Script project ID
- [.clasp.prod.json](.clasp.prod.json) - Production Apps Script project ID
- `.clasp.json` - Active environment (git-ignored, gets copied from above)

## 📝 Daily Development Workflow

### 1. Start Development Work

```bash
# Make sure you're on the dev branch
git checkout dev

# Switch to dev environment
./switch-env.sh dev

# Pull latest from dev Apps Script project (if needed)
clasp pull
```

### 2. Make Changes

Edit your files in VS Code:
- [Code.js](Code.js) - Main application logic
- [forms.html](forms.html) - Form interface
- [buildAdmin.html](buildAdmin.html) - Building admin interface
- [districtAdmin.html](districtAdmin.html) - District admin interface
- Other files as needed

### 3. Test in Development

```bash
# Verify you're in dev environment
./switch-env.sh

# Push changes to dev Apps Script
clasp push

# Open dev spreadsheet to test
# Go to: Field Trip Form - DEV 2025
```

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "Description of changes"

# Push to GitHub dev branch
git push origin dev
```

### 5. Deploy to Production (When Ready)

```bash
# Make sure all changes are committed
git status

# Switch to master branch
git checkout master

# Merge dev into master
git merge dev

# Push to GitHub
git push origin master

# Switch to production environment
./switch-env.sh prod

# Deploy to production ⚠️
clasp push

# Switch back to dev for safety
./switch-env.sh dev
git checkout dev
```

## ⚠️ Important Safety Rules

1. **NEVER** push directly to production without testing in dev first
2. **ALWAYS** verify your environment before running `clasp push`
3. **KEEP** `.clasp.json` git-ignored (contains active environment)
4. **TEST** thoroughly in dev spreadsheet before merging to master
5. **COMMIT** often to maintain good version history

## 📦 Project Files

### JavaScript Files
- [Code.js](Code.js) - Main doGet/doPost handlers and core logic
- [CalendarAdd.js](CalendarAdd.js) - Calendar integration
- [Merge.js](Merge.js) - Data merging functionality
- [PreMerge.js](PreMerge.js) - Pre-merge processing

### HTML Files
- [forms.html](forms.html) - Main form interface
- [buildAdmin.html](buildAdmin.html) - Building-level admin panel
- [districtAdmin.html](districtAdmin.html) - District-level admin panel
- [DoneAlready.html](DoneAlready.html) - Completion message

### Configuration
- [appsscript.json](appsscript.json) - Apps Script manifest
- [.claspignore](.claspignore) - Files excluded from Apps Script push

## 🛠️ Useful Commands

```bash
# Check CLASP version
clasp --version

# Check which files will be pushed
clasp status

# Pull changes from Apps Script
clasp pull

# Push changes to Apps Script
clasp push

# View deployed versions
clasp versions

# Create a new version
clasp version "Description"

# Deploy
clasp deploy
```

## 🔗 Links

- **GitHub Repository**: https://github.com/jvanarnhem/ofcs-fieldtrip-form
- **Production Spreadsheet**: [Open in Google Sheets]
- **Dev Spreadsheet**: Field Trip Form - DEV 2025

## 📚 Resources

- [CLASP Documentation](https://github.com/google/clasp)
- [Apps Script Documentation](https://developers.google.com/apps-script)
- [Apps Script Web Apps Guide](https://developers.google.com/apps-script/guides/web)
