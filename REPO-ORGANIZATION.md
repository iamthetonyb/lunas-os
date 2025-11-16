# LUNAS-OS Repository Organization

**Last Updated**: October 17, 2025  
**Status**: ✅ Clean & Organized

---

## 📁 Documentation Files

### Root Level (Essential Docs Only)

| File | Purpose | Size |
|------|---------|------|
| **README.md** | Main project documentation, setup, architecture | 20KB |
| **QUICK-START.md** | Fast setup & common commands | 3.7KB |
| **TROUBLESHOOTING.md** | Debug guide, crash recovery, fixes | 12KB |
| **CHANGELOG.md** | Track all project changes | 2.3KB |
| **REPO-ORGANIZATION.md** | This file - repository structure | - |

### docs/ Directory (Technical References)

| File | Purpose |
|------|---------|
| **docs/TESTING.md** | E2E testing setup and guidelines |

---

## 🎯 Which File to Read?

### I want to...

**Get started quickly**
→ Read `QUICK-START.md`

**Understand the full project**
→ Read `README.md`

**Fix a problem or debug**
→ Read `TROUBLESHOOTING.md`

**Set up E2E tests**
→ Read `docs/TESTING.md`

**See what changed**
→ Read `CHANGELOG.md`

---

## 📝 Documentation Guidelines

### For Developers

**When adding new features:**
- Update `README.md` if it affects setup or architecture
- Update `CHANGELOG.md` with the change
- Add troubleshooting steps to `TROUBLESHOOTING.md` if relevant

**Do NOT create:**
- Individual status files (STATUS.txt, FIXED.md, etc.)
- Session-specific documentation
- Temporary status reports

**Instead:**
- Update the appropriate existing file
- Use git commits for change history
- Use git log for project timeline

### For AI Assistants

**Read Before Write:**
Always check these files before making changes:
1. `README.md` - understand current state
2. `TROUBLESHOOTING.md` - know existing issues
3. `CHANGELOG.md` - see recent changes

**Update, Don't Create:**
- Update existing docs instead of creating new ones
- Consolidate information into the appropriate file
- Keep documentation DRY (Don't Repeat Yourself)

**Use Git for History:**
```bash
git log --oneline              # See recent commits
git show <commit>              # See specific change
git diff HEAD~5                # See last 5 changes
```

---

## 🗂️ Project Structure

```
LUNAS-OS/
├── 📄 README.md                    # Main documentation
├── 📄 QUICK-START.md               # Quick setup
├── 📄 TROUBLESHOOTING.md           # Debug guide
├── 📄 CHANGELOG.md                 # Change log
├── 📄 REPO-ORGANIZATION.md         # This file
│
├── 📁 app/                         # Next.js app directory
│   ├── (auth)/                    # Auth routes
│   ├── dashboard/                 # Dashboard
│   ├── intake/                    # Job intake
│   ├── schedule/                  # Scheduling
│   ├── dispatch/                  # Crew dispatch
│   ├── invoicing/                 # Billing
│   ├── contracts/                 # Contracts
│   ├── blue-book/                 # Blue Book integration
│   ├── import/                    # Data import
│   ├── users/                     # User management
│   ├── settings/                  # Settings
│   └── api/                       # API routes
│
├── 📁 components/                  # React components
│   ├── ui/                        # Reusable UI
│   ├── features/                  # Feature components
│   └── layouts/                   # Layout components
│
├── 📁 lib/                         # Utilities
│   ├── utils.ts                   # Helper functions
│   ├── api-handler.ts             # API utilities
│   └── validation.ts              # Validation schemas
│
├── 📁 db/                          # Database
│   ├── schema/                    # Drizzle schemas
│   ├── migrations-sqlite/         # SQLite migrations
│   └── index.ts                   # DB connection
│
├── 📁 scripts/                     # Build & utility scripts
│   ├── dev/                       # Dev utilities
│   │   └── keep-server-alive.sh  # Keep the dev server running
│   ├── seed.ts                    # Seed database
│   ├── migrate-sqlite.ts          # SQLite migrations
│   ├── migrate-pg.ts              # PostgreSQL migrations
│   └── e2e-*.mjs                  # E2E test runners
│
├── 📁 tests/                       # Test suites
│   └── e2e/                       # End-to-end tests
│
├── 📁 docs/                        # Additional documentation
│   └── TESTING.md                 # E2E testing guide
│
└── 📁 public/                      # Static assets
```

---

## 🧹 Cleanup History

### October 17, 2025 - Major Consolidation

**Removed 17 redundant files:**
- 14 status markdown files from root
- 3 duplicate docs from docs/

**Added 2 essential files:**
- TROUBLESHOOTING.md
- CHANGELOG.md

**Reorganized:**
- Moved dev scripts to scripts/dev/
- Renamed testing docs for clarity

**Result:**
- Net reduction: -2,616 lines of documentation
- Cleaner repository structure
- Single source of truth

---

## 📊 Documentation Statistics

| Metric | Count |
|--------|-------|
| Total documentation files | 5 |
| Root documentation files | 4 |
| Docs directory files | 1 |
| Total documentation size | ~38KB |
| Status files removed | 17 |
| Lines of redundant docs removed | 2,616 |

---

## ✅ Quality Checklist

- [x] No duplicate information
- [x] Clear file purposes
- [x] Logical organization
- [x] Up-to-date content
- [x] Easy to navigate
- [x] Git-friendly structure
- [x] AI assistant guidelines
- [x] Comprehensive troubleshooting
- [x] Change tracking (CHANGELOG)

---

## 🔄 Maintenance

### Monthly Review
- [ ] Update README.md with new features
- [ ] Add resolved issues to TROUBLESHOOTING.md
- [ ] Update CHANGELOG.md with version changes
- [ ] Remove outdated information

### Before Each Release
- [ ] Verify all documentation is current
- [ ] Update version numbers
- [ ] Add release notes to CHANGELOG.md
- [ ] Review and update troubleshooting guide

---

**Maintained by**: Tony B. <iam@thetonyb.com>  
**Repository**: LUNAS-OS (Construction Cleanup Management)  
**Status**: ✅ Production Ready
