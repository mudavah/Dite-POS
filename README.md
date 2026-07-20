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

- **Admin**: admin@shop.com / ChangeMe123!
- **Cashier**: cashier@shop.com / ChangeMe123!

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
DATABASE_URL="postgresql://user:password@localhost:5432/ditepos?schema=public"
AUTH_SECRET="your-super-secret-auth-key-change-this-in-production"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Dite POS"
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

### Vercel + Neon PostgreSQL

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Database Setup

```bash
# On Neon, create a new PostgreSQL database
# Copy the connection string to DATABASE_URL

# Run migrations
npm run db:push

# Seed data
npm run db:seed
```

## Documentation

- [Thermal Printer Setup Guide](./docs/printer-setup.md)
- [PWA Installation Guide](./docs/pwa-setup.md)
- [Deployment Guide](./docs/deployment.md)
- [Production Optimization Notes](./docs/optimization.md)

## License

MIT
