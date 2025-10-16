# Quick Start Guide - LUNAS-OS

## ✅ Current Stable Setup (Main Branch)

### Prerequisites
- Node.js 20.x LTS (recommended) or 18.x
- pnpm 10.x

### Initial Setup

```bash
# 1. Clone/navigate to repo
cd /Users/abenton333/LUNAS-OS

# 2. Install dependencies
pnpm install

# 3. Approve build scripts (if needed)
pnpm approve-builds
# Select: better-sqlite3

# 4. Build the app
pnpm build

# 5. Start production server
PORT=4010 pnpm start
```

### Accessing the App

- **URL**: http://localhost:4010
- **Login Page**: http://localhost:4010/login
- **Dashboard**: http://localhost:4010/dashboard

### Database

- **Type**: SQLite (development)
- **File**: `dev.db` (auto-created)
- **Config**: Set in `.env.local`
- **No Docker needed!**

### Environment Variables

Create/check `.env.local`:
```env
NEXTAUTH_URL=http://localhost:4010
BASE_URL=http://localhost:4010
SQLITE_PATH=dev.db
PORT=4010
```

---

## 🔧 Common Tasks

### Development Mode (if CSS works)
```bash
pnpm dev
```
**Note**: If you see "Module parse failed: Unexpected character '@'", use production mode instead.

### Production Mode (Recommended)
```bash
# Build first
pnpm build

# Then start
pnpm start
```

### Clean Rebuild
```bash
rm -rf .next node_modules
pnpm install
pnpm build
pnpm start
```

### Database Operations

```bash
# Generate SQLite migrations
pnpm db:generate:sqlite

# Run SQLite migrations
pnpm db:migrate:sqlite

# Build and seed database
pnpm build:scripts
pnpm db:seed

# Full setup
pnpm db:setup:sqlite
```

### Linting & Formatting
```bash
# Lint
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

---

## 🚨 Troubleshooting

### Server Won't Start

**Problem**: Port already in use
```bash
# Find and kill process on port 4010
lsof -ti:4010 | xargs kill -9
```

**Problem**: Build errors
```bash
# Clean everything
rm -rf .next node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

### CSS Not Loading

**Symptom**: "Module parse failed: Unexpected character '@'"

**Solution 1**: Use production mode
```bash
pnpm build && pnpm start
```

**Solution 2**: Check Node version
```bash
node -v
# Should be 20.x or 18.x (not 24.x)
```

**Solution 3**: Force rebuild
```bash
rm -rf .next
pnpm build
```

### Database Issues

**Problem**: Database locked
```bash
# Remove database file
rm dev.db dev.db-*

# Recreate
pnpm db:setup:sqlite
```

**Problem**: Connection errors
- Check `.env.local` has `SQLITE_PATH=dev.db`
- Ensure no `DATABASE_URL` is set (or comment it out)

---

## 📊 Server Status

### Check if Server is Running
```bash
curl http://localhost:4010/__e2e-ready
# Should return: {"ok":true,"app":"lunas"}
```

### View Server Logs
The server logs are in the terminal where you ran `pnpm start` or `pnpm dev`.

---

## 🎯 Port Reference

- **Main (v1 - Stable)**: 4010
- **V2 (Modern - Future)**: 4020

---

## 📝 Git Workflow

### Commit Changes
```bash
git add -A
git commit -m "Your message"
```

### Check Status
```bash
git status
git log --oneline -5
```

### Current Branch
```bash
git branch
# Should show: * main
```

---

## 🏃 Quick Commands Reference

```bash
# Start app (production)
pnpm start

# Build app
pnpm build

# Dev mode (if working)
pnpm dev

# Run tests
pnpm test:e2e

# Lint code
pnpm lint

# Format code
pnpm format

# Database setup
pnpm db:setup:sqlite

# Clean restart
rm -rf .next && pnpm build && pnpm start
```

---

## ✨ Current Working State

- ✅ Production server runs reliably
- ✅ Login page renders with styling
- ✅ All routes compile successfully
- ✅ Database uses SQLite (no Docker)
- ✅ Builds complete without errors
- ⚠️ Dev mode has CSS loading issue (use prod mode)

---

**Last Updated**: October 16, 2025
**Branch**: main
**Port**: 4010
**Status**: Stable in production mode
