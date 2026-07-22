# Dite POS

Modern, production-ready Point of Sale (POS) System designed for small-to-medium retail businesses with multi-branch support, offline capability, and eTRS receipt generation.

## Features

- **Multi-Branch Support**: Separate inventory, sales, and settings per branch
- **Offline-First PWA**: Continue selling during internet outages with IndexedDB sync
- **eTRS Receipts**: Kenyan Electronic Tax Register System compliant receipts
- **Thermal Printing**: ESC/POS support for 58mm/80mm printers via WebUSB/WebBluetooth
- **Strict RBAC**: Admin and Cashier roles with protected routes
- **Real-time POS**: Fast product search, cart management, keyboard shortcuts
- **Inventory Management**: Stock tracking, transfers, adjustments, low stock alerts
- **Reports**: Sales, product, inventory, profit, cashier, and branch reports with CSV/PDF export

## Tech Stack

- **Framework**: Next.js 16 (App Router + React Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL with Prisma ORM v7
- **Authentication**: NextAuth.js v5
- **Validation**: Zod
- **State Management**: TanStack Query
- **PWA**: next-pwa + Workbox
- **Offline Storage**: IndexedDB via idb-keyval

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

```bash
# Clone the repository
cd dite-pos

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

### Default Credentials

Default accounts are created by the seed script. See `prisma/seeds/index.ts` for the seeded admin and cashier accounts.

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/[...nextauth]/  # NextAuth handler
│   │   ├── pos/         # POS-specific APIs
│   │   ├── products/    # Product management
│   │   ├── inventory/   # Inventory management
│   │   ├── sales/       # Sales processing
│   │   ├── branches/    # Branch management
│   │   ├── users/       # User management
│   │   ├── reports/     # Reporting APIs
│   │   ├── printer/     # Printer APIs
│   │   ├── etrs/        # eTRS receipt APIs
│   │   └── sync/        # Offline sync APIs
│   ├── dashboard/       # Admin dashboard
│   ├── pos/             # POS terminal
│   ├── products/        # Product management pages
│   ├── inventory/       # Inventory management pages
│   ├── reports/         # Reports pages
│   ├── settings/        # Settings pages
│   ├── branches/        # Branch management pages
│   ├── users/           # User management pages
│   ├── login/           # Login page
│   └── layout.tsx       # Root layout
├── components/
│   ├── ui/              # Reusable UI components
│   ├── pos/             # POS-specific components
│   ├── layout/          # Layout components (sidebar)
│   └── providers.tsx    # React providers
├── lib/
│   ├── actions/         # Server actions
│   ├── auth/            # Auth configuration
│   ├── offline/         # IndexedDB and sync engine
│   ├── printer/         # Thermal printer module
│   ├── etrs/            # eTRS receipt generator
│   ├── validators.ts    # Zod schemas
│   ├── utils.ts         # Utility functions
│   ├── env.ts           # Environment validation
│   └── prisma.ts        # Prisma client
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
└── middleware.ts        # Auth middleware
prisma/
├── schema.prisma        # Database schema
├── seeds/               # Database seed script
└── config.ts            # Prisma 7 config
public/
├── sw.js                # Service Worker
└── manifest.json        # PWA manifest
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking

npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

## Environment Variables

```env
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/ditepos?schema=public"

# NextAuth (required)
AUTH_SECRET="your-super-secret-auth-key-min-32-chars-change-in-production"
AUTH_URL="http://localhost:3000"

# App (required)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Dite POS"

# Environment (optional)
NODE_ENV="production"
LOG_LEVEL="info"

# Seed Script (optional - defaults to ChangeMe123! if unset)
SEED_ADMIN_PASSWORD="your-secure-admin-password"
SEED_CASHIER_PASSWORD="your-secure-cashier-password"
```

## User Roles

### Admin
- Full access to all features
- Manage products, inventory, branches, users
- View reports and analytics
- Configure system settings

### Cashier
- POS terminal access
- Hold/recall sales
- Daily cashier summary
- Customer selection
- Receipt printing

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F1 | Focus search |
| Enter | Add selected product |
| F2 | Open checkout |
| ESC | Close modals |
| Ctrl+H | Hold sale |

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong `AUTH_SECRET` (min 32 characters, random)
- [ ] Configure `DATABASE_URL` with connection pooling (e.g., PgBouncer)
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Run `npm run db:migrate` before first deploy
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall to allow only ports 80, 443, and 5432
- [ ] Set up automated database backups

### Docker (Recommended)

```bash
# Build and start with Docker Compose
docker compose up -d --build

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Seed initial data
docker compose exec app npm run db:seed

# View logs
docker compose logs -f app
```

### Vercel + Neon PostgreSQL

#### Step 1: Create a new Vercel project
1. Push this code to a **new** GitHub repository (fresh account = fresh repo)
2. In Vercel, click **"Add New..." → "Project"**
3. Import the new GitHub repository
4. Vercel will auto-detect Next.js

#### Step 2: Set environment variables in Vercel
Before deploying, add these in **Vercel → Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `AUTH_SECRET` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_URL` | `https://your-project.vercel.app` (your actual Vercel URL) |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |
| `NEXT_PUBLIC_APP_NAME` | `Dite POS` (optional) |

Make sure these are set for **Production**, **Preview**, and **Development** environments.

#### Step 3: Deploy
Click **Deploy**. Vercel will build and deploy the app.

#### Step 4: Seed the database
After the first deploy, seed your database:
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Pull environment variables
vercel env pull .env

# Run seed script
npx prisma db push
npx tsx prisma/seeds/index.ts
```

#### Step 5: Log in
Use the seeded credentials:
- **Admin:** `admin@shop.com` / `ChangeMe123!`
- **Cashier:** `cashier@shop.com` / `ChangeMe123!`

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

### Health Check

The app exposes a health endpoint at `GET /api/health` that returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "production",
  "database": { "status": "healthy" }
}
```

Use this for load balancer health checks and monitoring.

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string with pooling |
| `AUTH_SECRET` | Yes | NextAuth secret (min 32 chars, random) |
| `AUTH_URL` | Yes | Canonical app URL |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (exposed to browser) |
| `NEXT_PUBLIC_APP_NAME` | No | App name (default: "Dite POS") |
| `NODE_ENV` | No | Environment (default: "development") |
| `LOG_LEVEL` | No | Log level: debug, info, warn, error (default: warn in production) |
| `SEED_ADMIN_PASSWORD` | No | Admin seed password |
| `SEED_CASHIER_PASSWORD` | No | Cashier seed password |

## Documentation

- [Thermal Printer Setup Guide](./docs/printer-setup.md)
- [PWA Installation Guide](./docs/pwa-setup.md)
- [Deployment Guide](./docs/deployment.md)
- [Production Optimization Notes](./docs/optimization.md)

## License

MIT
