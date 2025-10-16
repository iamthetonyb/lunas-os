# Git Hooks Quick Reference Guide

## What Are Git Hooks?

Git hooks are scripts that automatically run before or after Git commands like commit, push, and merge. They help maintain code quality by catching issues before they enter your repository.

---

## 🎯 Your Setup

### Pre-commit Hook
**Runs before**: `git commit`  
**Checks**:
- ✅ Linting (code style)
- ✅ Unit tests

**What happens**: If either check fails, the commit is blocked.

### Pre-push Hook
**Runs before**: `git push`  
**Checks**:
- ✅ Full linting
- ✅ All unit tests
- ✅ Production build

**What happens**: If any check fails, the push is blocked.

---

## 💻 Using Git Hooks

### Normal Workflow (Recommended)

```bash
# 1. Make your changes
# Edit files...

# 2. Stage changes
git add .

# 3. Commit (hooks run automatically)
git commit -m "Add feature X"
# 🔍 Running pre-commit checks...
# 📋 Running linter...
# 🧪 Running unit tests...
# ✅ Pre-commit checks passed!

# 4. Push (hooks run automatically)
git push
# 🚀 Running pre-push checks...
# 📋 Running full linter...
# 🧪 Running unit tests...
# 🏗️  Checking build...
# ✅ Pre-push checks passed!
```

### If Checks Fail

**Example failure:**
```bash
git commit -m "My changes"
# 🔍 Running pre-commit checks...
# 📋 Running linter...
# ❌ Linting failed. Please fix the errors before committing.
```

**What to do:**
```bash
# Fix the linting errors
pnpm lint:fix

# Or fix manually, then try again
git add .
git commit -m "My changes"
```

---

## 🚨 Emergency Bypass (Use Sparingly!)

**When to use**: Only for emergency hotfixes or if hooks are malfunctioning.

```bash
# Bypass pre-commit hook
git commit --no-verify -m "Emergency fix"

# Bypass pre-push hook
git push --no-verify
```

⚠️ **Warning**: Bypassing hooks can introduce broken code into your repository. Use only when absolutely necessary!

---

## 🔧 Manual Testing

Run checks manually before committing:

```bash
# Run linter
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Run unit tests
pnpm test:unit run

# Build check
pnpm build
```

---

## 📊 What Each Check Does

### Linting (`pnpm lint`)
- Checks code style and formatting
- Catches common errors
- Ensures consistency
- **Time**: ~5-10 seconds

### Unit Tests (`pnpm test:unit`)
- Runs automated tests
- Verifies code works correctly
- Catches breaking changes
- **Time**: ~10-30 seconds

### Build Check (`pnpm build`)
- Compiles TypeScript
- Checks for type errors
- Verifies production readiness
- **Time**: ~20-60 seconds

---

## 🎓 Best Practices

### DO ✅
- Let hooks run every time
- Fix issues immediately
- Run manual checks before big commits
- Keep tests fast
- Commit often with small changes

### DON'T ❌
- Bypass hooks regularly
- Ignore hook failures
- Commit large changesets
- Push untested code
- Disable hooks permanently

---

## 🛠️ Troubleshooting

### "Hook not executing"
```bash
# Reinstall hooks
cd /Users/abenton333/LUNAS-OS
pnpm husky install
```

### "Hook always fails"
```bash
# Check what's failing
pnpm lint          # Test linter
pnpm test:unit run # Test tests
pnpm build         # Test build
```

### "Hook is too slow"
```bash
# Skip unit tests in pre-commit (not recommended)
# Edit .husky/pre-commit and comment out test section
```

### "Need to disable temporarily"
```bash
# Set environment variable
export HUSKY=0  # Disables all hooks

# When done
unset HUSKY     # Re-enables hooks
```

---

## 📁 Hook Files Location

```
.husky/
├── pre-commit     # Runs before commit
├── pre-push       # Runs before push
└── _/
    └── husky.sh   # Helper script
```

---

## 🔄 Updating Hooks

### Modify Pre-commit Hook
```bash
# Edit the file
nano .husky/pre-commit

# Make executable
chmod +x .husky/pre-commit
```

### Modify Pre-push Hook
```bash
# Edit the file
nano .husky/pre-push

# Make executable
chmod +x .husky/pre-push
```

---

## 💡 Tips

1. **Commit Often**: Smaller commits = faster hooks
2. **Fix Fast**: Don't let issues pile up
3. **Test Locally**: Run checks before committing
4. **Watch Output**: Read what hooks tell you
5. **Keep Clean**: Fix warnings, not just errors

---

## 📈 Benefits

### Before Git Hooks
- ❌ Broken code in repository
- ❌ Manual quality checks
- ❌ Production bugs
- ❌ Inconsistent code style
- ❌ Time wasted reviewing bad PRs

### After Git Hooks
- ✅ Only working code committed
- ✅ Automatic quality checks
- ✅ Fewer production bugs
- ✅ Consistent code style
- ✅ Faster code reviews

---

## 🎯 Quick Commands

```bash
# Commit with hooks
git commit -m "message"

# Commit without hooks (emergency)
git commit --no-verify -m "message"

# Push with hooks
git push

# Push without hooks (emergency)
git push --no-verify

# Test hooks manually
pnpm lint && pnpm test:unit run && pnpm build

# Disable hooks temporarily
export HUSKY=0

# Re-enable hooks
unset HUSKY
```

---

## 📚 Learn More

- **Husky Docs**: https://typicode.github.io/husky/
- **Git Hooks**: https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks
- **ESLint**: https://eslint.org/
- **Vitest**: https://vitest.dev/

---

**Remember**: Git hooks are your friend! They catch issues early and keep your codebase healthy. 🚀
