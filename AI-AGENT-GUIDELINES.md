# AI Agent Guidelines for LUNAS-OS

This document provides best practices for AI assistants (GitHub Copilot, Claude, Gemini, etc.) working on the LUNAS-OS project.

---

## 🎯 Primary Objectives

1. **Keep the project lean and maintainable**
2. **Follow established patterns and conventions**
3. **Avoid creating documentation bloat**
4. **Read before writing to prevent data loss**
5. **Update existing documentation rather than creating new files**

---

## 📋 Before Each Session

### 1. **Check Current State**
```bash
# Review recent changes
git log --oneline -10

# Check current branch
git branch

# View uncommitted changes
git status

# Check if server is running
lsof -i :4010
```

### 2. **Read Key Documentation**
Always read these files at the start of a session:
- `README.md` - Current project state and setup
- `TROUBLESHOOTING.md` - Known issues
- `.env.example` - Required environment variables

### 3. **Understand the Project Structure**
```
LUNAS-OS/
├── app/              ← Next.js pages (READ BEFORE MODIFYING)
├── components/       ← Reusable components (READ BEFORE MODIFYING)
├── lib/              ← Utilities
├── db/               ← Database schema
├── docs/sessions/    ← Historical logs (DO NOT modify)
└── README.md         ← MAIN DOCUMENTATION (UPDATE THIS)
```

---

## ✅ Best Practices

### 1. **Always Read Files Before Writing**

**❌ BAD:**
```typescript
// Creating a new component without checking if it exists
create_file("components/button.tsx", "...")
```

**✅ GOOD:**
```typescript
// Check if component exists first
view_file("components/button.tsx")
// If exists, use str_replace; if not, then create
```

**Why**: Prevents accidental overwrites and data loss.

### 2. **Update README Instead of Creating Status Files**

**❌ BAD:**
```bash
# Creating separate status files
SESSION-4-STATUS.txt
CURRENT-FIXES.md
NEW-CHANGES.txt
```

**✅ GOOD:**
```bash
# Update the README.md "Current Status" section
# Or update TROUBLESHOOTING.md if it's a fix
```

**Why**: Keeps documentation centralized and prevents bloat.

### 3. **Consolidate Related Changes**

**❌ BAD:**
```
FIX-1.md
FIX-2.md
FIX-3.md
UPDATE-A.md
UPDATE-B.md
```

**✅ GOOD:**
```
README.md (updated with all changes)
TROUBLESHOOTING.md (if fixes)
```

**Why**: Easier to find information, less clutter.

### 4. **Use Git History Instead of Status Files**

**❌ BAD:**
```
Creating "WHAT-I-DID.txt" to track changes
```

**✅ GOOD:**
```bash
# Use descriptive git commits
git commit -m "fix: resolved layout overlapping issue in navigation"

# View change history
git log --oneline
git show <commit-hash>
```

**Why**: Git is designed for this; no need to duplicate.

### 5. **Follow Existing Code Patterns**

**Before adding new code:**
1. Search for similar existing implementations
2. Follow the same structure and naming conventions
3. Use existing utilities instead of creating new ones

**Example:**
```bash
# Find existing button components
find components -name "*button*"

# Look at existing patterns
cat components/ui/button.tsx
```

### 6. **Keep Component Organization Clean**

**Component Structure:**
```
components/
├── ui/              ← Generic, reusable UI elements
│   ├── button.tsx
│   ├── input.tsx
│   └── card.tsx
├── features/        ← Feature-specific components
│   ├── dashboard/
│   ├── intake/
│   └── schedule/
└── layouts/         ← Page layouts
    ├── app-layout.tsx
    └── navigation.tsx
```

**❌ BAD:** Creating `components/new-button-component.tsx`  
**✅ GOOD:** Using or extending `components/ui/button.tsx`

### 7. **Security Best Practices**

**❌ NEVER:**
- Commit credentials to version control
- Store secrets in plain text files
- Include API keys in documentation

**✅ ALWAYS:**
- Use `.env.local` for secrets (already in .gitignore)
- Provide examples in `.env.example` without real values
- Reference environment variables in documentation, not values

**Example:**
```markdown
# ❌ BAD
API_KEY=sk_live_abc123xyz789

# ✅ GOOD
API_KEY=your-api-key-here
```

---

## 🚫 Things to Avoid

### 1. **Don't Modify node_modules/**
- These are third-party dependencies
- Managed by pnpm
- Changes will be lost on `pnpm install`

### 2. **Don't Create Redundant Documentation**
- Don't create `SESSION-X-SUMMARY.md` files
- Don't create `CURRENT-STATUS.txt` files
- Update README.md instead

### 3. **Don't Break Existing Functionality**
- Always test changes before committing
- Run `pnpm lint` to catch issues
- Run `pnpm test:unit` if tests exist

### 4. **Don't Use Absolute Positioning Without Good Reason**
- The project uses Flexbox layouts
- Absolute positioning can cause overlapping issues
- See `docs/sessions/LAYOUT-FIXES.md` for examples

### 5. **Don't Duplicate Components**
- Search for existing components first
- Extend or modify existing ones
- Create new ones only if truly needed

---

## 📝 Documentation Updates

### When to Update README.md
- Adding new features
- Changing setup process
- Updating dependencies
- Modifying scripts
- Changing architecture

### When to Update TROUBLESHOOTING.md
- Fixing bugs
- Resolving common errors
- Adding workarounds
- Documenting edge cases

### When to Create New Documentation
- **Only if** it's a major architectural change
- **Only if** it needs permanent reference (not session notes)
- **Only if** it can't fit in README or TROUBLESHOOTING

---

## 🔄 Session Workflow

### Starting a Session
```bash
1. cd /Users/abenton333/LUNAS-OS
2. git pull origin main
3. cat README.md  # Read current state
4. git log --oneline -5  # Review recent changes
```

### During Development
```bash
1. Read files before modifying
2. Make minimal, surgical changes
3. Test changes locally
4. Lint code: pnpm lint
5. Run tests: pnpm test:unit
```

### Ending a Session
```bash
1. Update README.md if needed (Current Status section)
2. Commit changes with descriptive message
3. DO NOT create "SESSION-X-SUMMARY.md"
4. DO NOT create status files
```

**Example Final Commit:**
```bash
git add .
git commit -m "feat: add user profile dropdown to navigation

- Added ProfileDropdown component
- Updated Navigation to include user menu
- Added sign-out functionality
- Updated README with new feature"

git push origin main
```

---

## 🎨 Code Style

### TypeScript
- Use TypeScript for all new files
- Define interfaces for props
- Use type inference where possible
- Avoid `any` type

### React
- Use functional components
- Use hooks (useState, useEffect, etc.)
- Keep components small and focused
- Extract reusable logic into custom hooks

### Tailwind CSS
- Use utility classes
- Avoid inline styles
- Use design tokens (colors, spacing)
- Maintain responsive design

### File Naming
```
components/
├── UserProfile.tsx       ← PascalCase for components
├── use-auth.ts          ← kebab-case for utilities
└── types.ts             ← lowercase for types/interfaces
```

---

## 🧪 Testing Before Committing

### Manual Testing
```bash
# 1. Start dev server
pnpm dev

# 2. Test in browser
open http://localhost:4010

# 3. Check for console errors
# 4. Test navigation
# 5. Test forms/interactions
```

### Automated Testing
```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint --fix

# Run unit tests (if they exist)
pnpm test:unit

# Run E2E tests (if needed)
pnpm test:e2e
```

---

## 📦 Managing Dependencies

### Adding Dependencies
```bash
# Check if similar package already exists
cat package.json | grep <package-name>

# Install only if needed
pnpm add <package-name>

# Update README if it's a significant dependency
```

### Removing Dependencies
```bash
# Remove unused package
pnpm remove <package-name>

# Clean up imports in code
# Update README if it was documented
```

---

## 🐛 Debugging Issues

### Common Issues Checklist
1. Is the database running? (`lsof -i :5432`)
2. Are environment variables set? (`.env.local` exists?)
3. Are dependencies installed? (`node_modules/` exists?)
4. Is port 4010 available? (`lsof -i :4010`)
5. Did you clear cache? (`rm -rf .next`)

### Debugging Process
```bash
# 1. Read TROUBLESHOOTING.md first
cat TROUBLESHOOTING.md

# 2. Check recent changes
git log --oneline -10
git diff HEAD~1

# 3. Search for similar issues
grep -r "error message" .

# 4. Check console/terminal output
# 5. Add to TROUBLESHOOTING.md if new issue
```

---

## 📊 Performance Considerations

### Build Performance
- Use Turbopack for dev (`pnpm dev`)
- Clear `.next/` if builds are slow
- Check bundle size on major changes

### Runtime Performance
- Use React.memo for expensive components
- Lazy load heavy components
- Optimize images and assets
- Use server components when possible

---

## 🔐 Security Checklist

Before committing:
- [ ] No hardcoded credentials
- [ ] No API keys in code
- [ ] `.env.local` not committed
- [ ] Sensitive data in environment variables
- [ ] No debug logs with sensitive info
- [ ] Input validation implemented
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention (React default escaping)

---

## 📖 Additional Resources

### Internal Documentation
- `README.md` - Main documentation
- `TROUBLESHOOTING.md` - Common issues
- `TURBOPACK-SETUP.md` - Build optimization
- `docs/sessions/` - Historical logs (reference only)

### External Resources
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind Docs](https://tailwindcss.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team)

---

## 🎯 Success Criteria

A good session means:
- ✅ README.md is updated (not new files created)
- ✅ Code follows existing patterns
- ✅ Tests pass
- ✅ No console errors
- ✅ Documentation is current
- ✅ Changes are minimal and focused
- ✅ No unnecessary files created

A bad session means:
- ❌ Multiple status files created
- ❌ Documentation scattered across files
- ❌ Breaking existing functionality
- ❌ Not reading files before writing
- ❌ Ignoring existing patterns
- ❌ Creating component duplicates

---

## 🤖 AI-Specific Tips

### For GitHub Copilot
- Use context from open files
- Reference existing components
- Follow established patterns
- Don't create redundant files

### For Claude
- Read project documentation first
- Ask clarifying questions
- Provide context in prompts
- Update README with changes

### For Gemini
- Understand project structure
- Check existing implementations
- Consolidate documentation
- Test before finalizing

### For All AI Agents
1. **Read** files before writing
2. **Update** existing docs, don't create new ones
3. **Follow** established patterns
4. **Test** changes locally
5. **Document** in README, not separate files

---

**Last Updated**: October 16, 2025  
**For**: GitHub Copilot, Claude, Gemini, and other AI assistants  
**Project**: LUNAS-OS v0.1.0
