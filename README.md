# LUNAS-OS

**Construction Cleanup Management System** - A comprehensive platform for managing construction cleanup operations, scheduling, invoicing, and crew dispatch.

[![Next.js](https://img.shields.io/badge/Next.js-15.5.5-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8)](https://tailwindcss.com/)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (v24.5.0 recommended)
- pnpm (package manager)
- PostgreSQL 14+
- Docker (optional, for database)

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 3. Set up database (auto: generate, migrate, seed)
pnpm db:setup

# 4. Start development server
pnpm dev
```

The application will be available at **http://localhost:4010**

### Default Development Credentials
```
Email:    dispatcher@lunas.com
Password: password
```
> ⚠️ **Security Note**: These credentials are for development only. Change them in production via environment variables.

---

## 📚 Table of Contents

- [Project Structure](#-project-structure)
- [Available Scripts](#-available-scripts)
- [Environment Variables](#-environment-variables)
- [Development Workflow](#-development-workflow)
- [Architecture](#-architecture)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 📁 Project Structure

```
lunas-os/
├── app/                    # Next.js 15 app directory
│   ├── (auth)/            # Authentication routes
│   ├── dashboard/         # Main dashboard
│   ├── intake/            # Job intake management
│   ├── schedule/          # Scheduling & calendar
│   ├── dispatch/          # Crew dispatch
│   ├── invoicing/         # Billing & invoicing
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── features/         # Feature-specific components
├── lib/                  # Utility functions & helpers
├── db/                   # Database schema & migrations
├── services/             # Business logic layer
├── tests/                # Test suites
├── scripts/              # Build & maintenance scripts
├── public/               # Static assets
└── docs/                 # Documentation
    └── sessions/         # Historical session logs
```

---

## 🛠 Available Scripts

### Development
```bash
pnpm dev              # Start dev server with Turbopack (Port 4010)
pnpm dev:webpack      # Start dev server with Webpack (fallback)
pnpm dev:safe         # Start with safe mode script
```

### Database
```bash
pnpm db:setup         # Complete setup (generate + migrate + seed)
pnpm db:generate      # Generate migrations from schema
pnpm db:migrate       # Run pending migrations
pnpm db:seed          # Seed database with test data
pnpm db:reset         # Reset and rebuild database
```

### Building & Production
```bash
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
```

### Testing
```bash
pnpm test:unit        # Run unit tests with Vitest
pnpm test:e2e         # Run E2E tests with Puppeteer
```

---

## 🔐 Environment Variables

Create a `.env.local` file in the root directory. See `.env.example` for all available options.

### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lunas_db

# Authentication
NEXTAUTH_URL=http://localhost:4010
NEXTAUTH_SECRET=your-secret-key-here

# Development Credentials (optional, defaults provided)
DEFAULT_USER_EMAIL=dispatcher@lunas.com
DEFAULT_USER_PASSWORD=password
```

### Optional Services
```env
# Email (Resend)
RESEND_API_KEY=

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=

# File Storage (UploadThing or S3)
STORAGE_DRIVER=uploadthing
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=
```

> 🔒 **Security**: Never commit `.env.local` to version control. It's already in `.gitignore`.

---

## 💻 Development Workflow

### 1. **Before Starting Work**
```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
pnpm install

# Check database is running
docker-compose up -d  # Or start PostgreSQL manually
```

### 2. **During Development**

#### Read Before Write
Always view files before editing to understand current state:
```bash
# Example: View component before modifying
cat components/dashboard/page.tsx
```

#### Lint Your Code
The project uses ESLint for code quality:
```bash
pnpm lint          # Check for issues
pnpm lint --fix    # Auto-fix issues
```

#### Hot Module Replacement (HMR)
Turbopack provides instant feedback:
- Changes appear in <100ms
- No manual refresh needed
- Preserves component state

### 3. **Testing Changes**
```bash
# Run unit tests
pnpm test:unit

# Run specific test file
pnpm test:unit path/to/test.test.ts

# Run E2E tests
pnpm test:e2e
```

### 4. **Committing Changes**
```bash
git add .
git commit -m "feat: descriptive message"
git push origin your-branch
```

---

## 🏗 Architecture

### Tech Stack
- **Framework**: Next.js 15.5.5 with App Router
- **Language**: TypeScript 5.x
- **UI**: React 19.1.0 + Tailwind CSS 4.x
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: NextAuth.js
- **File Storage**: UploadThing / S3
- **Testing**: Vitest (unit) + Puppeteer (E2E)
- **Build Tool**: Turbopack (dev) / Webpack (prod)

### Key Design Decisions

#### 1. **App Router over Pages Router**
Using Next.js 15's app directory for:
- Server Components by default
- Streaming and Suspense support
- Improved layouts and nested routing
- Better SEO and performance

#### 2. **Turbopack for Development**
Enabled for faster development:
- Initial compile: ~1.2s (vs 5s with Webpack)
- HMR: <100ms (vs 500ms)
- Memory: -30% usage
- See `TURBOPACK-SETUP.md` for details

#### 3. **Flexbox Layout System**
Pure CSS Flexbox without absolute positioning:
- Navigation sidebar (w-64, fixed width)
- Main content (flex-1, fills remaining space)
- No manual margin compensation
- See `docs/sessions/LAYOUT-FIXES.md`

#### 4. **Component Organization**
```
components/
├── ui/              # Atomic design: buttons, inputs, cards
├── features/        # Feature-specific: forms, tables, charts
├── layouts/         # Page layouts and wrappers
└── shared/          # Shared across features
```

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
# Run all tests
pnpm test:unit

# Watch mode
pnpm test:unit --watch

# Coverage report
pnpm test:unit --coverage
```

### E2E Tests (Puppeteer)
```bash
# Install browser (first time only)
pnpm pretest:e2e

# Run E2E tests
pnpm test:e2e
```

### Manual Testing Checklist
- [ ] Login flow works
- [ ] Navigation sidebar functions
- [ ] All pages load without errors
- [ ] Forms submit correctly
- [ ] API endpoints respond
- [ ] Database operations succeed

---

## 🚀 Deployment

### Build for Production
```bash
# Create optimized build
pnpm build

# Test production build locally
pnpm start
```

### Environment Setup
Ensure all production environment variables are set:
- `DATABASE_URL` (production database)
- `NEXTAUTH_SECRET` (strong random string)
- `NEXTAUTH_URL` (production URL)
- API keys for external services

### Deployment Platforms
- **Vercel**: Native Next.js support (recommended)
- **Docker**: Use provided `docker-compose.yml`
- **VPS**: Build and run with Node.js

---

## 🐛 Troubleshooting

### Common Issues

#### Port 4010 Already in Use
```bash
# Find process using port
lsof -i :4010

# Kill process
kill -9 <PID>
```

#### Database Connection Errors
```bash
# Check PostgreSQL is running
lsof -i :5432

# Start database (Docker)
docker-compose up -d

# Run migrations
pnpm db:migrate
```

#### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next
pnpm install
pnpm dev
```

#### NODE_ENV Issues
```bash
# If middleware errors occur
unset NODE_ENV
pnpm dev
```

For more details, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 📖 Documentation

### Core Documentation
- **README.md** (this file) - Project overview and setup
- **TROUBLESHOOTING.md** - Common issues and solutions
- **TURBOPACK-SETUP.md** - Performance optimization details

### Historical Documentation
Located in `docs/sessions/`:
- Session logs and status reports
- Incremental improvements and fixes
- Architecture evolution notes

### AI Agent Guidelines
When working with AI assistants (GitHub Copilot, Claude, Gemini):
1. **Read before write** - Always view files before editing
2. **Update README** - Don't create separate status files
3. **Consolidate docs** - Add to existing docs, don't duplicate
4. **Use git log** - For change history instead of status files
5. **Follow structure** - Keep components organized by feature

---

## 🤝 Contributing

### Code Style
- Follow TypeScript and ESLint rules
- Use Tailwind CSS utility classes
- Maintain component modularity
- Write descriptive commit messages

### Commit Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code style changes (formatting)
refactor: Code refactoring
test: Test additions or changes
chore: Maintenance tasks
```

### Pull Request Process
1. Create feature branch from `main`
2. Make changes and test thoroughly
3. Update documentation if needed
4. Run linter and tests
5. Submit PR with clear description

---

## 📊 Current Status

### ✅ Working Features
- Authentication & authorization
- Dashboard with statistics
- Job intake management
- Scheduling & calendar
- User management
- Settings & configuration
- Data import tools

### 🚧 In Development
- Invoice generation (API setup needed)
- Blue Book integration (API setup needed)
- Contract management (API setup needed)

### 🎯 Upcoming
- Mobile responsive improvements
- Dark mode support
- Advanced reporting
- Real-time notifications

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 🙋 Support

For questions or issues:
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review documentation in `docs/`
3. Search existing GitHub issues
4. Contact development team

---

**Last Updated**: October 16, 2025  
**Version**: 0.1.0  
**Node.js**: 24.5.0  
**pnpm**: Latest
