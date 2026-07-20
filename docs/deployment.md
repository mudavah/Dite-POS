# Deployment Guide

This guide covers deploying Dite POS to production using Vercel and Neon PostgreSQL.

## Prerequisites

- Vercel account
- Neon PostgreSQL account
- GitHub repository

## Step 1: Database Setup (Neon)

1. Create a new Neon PostgreSQL project
2. Copy the connection string (pooled connection recommended)
3. Note the database name, user, and password

## Step 2: Environment Variables

Create a `.env` file or configure in Vercel:

```env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/ditepos?sslmode=require"
AUTH_SECRET="generate-a-secure-random-string-here"
AUTH_URL="https://your-app.vercel.app"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
NEXT_PUBLIC_APP_NAME="Dite POS"
```

### Generating AUTH_SECRET

```bash
openssl rand -base64 32
```

## Step 3: Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B: GitHub Integration

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Connect GitHub repository
4. Add environment variables
5. Deploy

## Step 4: Database Migration

```bash
# Run Prisma migrations
npm run db:push

# Seed initial data
npm run db:seed
```

## Step 5: Configure Domain (Optional)

1. Add custom domain in Vercel dashboard
2. Update DNS records
3. Enable SSL (automatic with Vercel)

## Production Checklist

- [ ] Environment variables configured
- [ ] Database migrated and seeded
- [ ] HTTPS enabled
- [ ] AUTH_SECRET is secure and unique
- [ ] Printer configured per branch
- [ ] eTRS device configured (if applicable)
- [ ] Backup strategy in place
- [ ] Monitoring enabled

## Scaling Considerations

### Database
- Use Neon's scale-to-zero for cost optimization
- Enable connection pooling for high traffic
- Consider read replicas for reporting

### Application
- Enable Vercel Edge Network caching
- Use ISR for static pages
- Configure rate limiting

### Monitoring
- Vercel Analytics for performance
- Neon console for database metrics
- Custom audit logs in application

## Backup Strategy

### Database Backups
- Neon provides automatic daily backups
- Enable point-in-time recovery
- Export critical data regularly

### Application Backups
- Vercel maintains deployment history
- Export environment variables securely
- Document custom configurations

## Security

- Enable Vercel's DDoS protection
- Use strong AUTH_SECRET
- Enable rate limiting on API routes
- Regular dependency audits (`npm audit`)
- Keep Next.js and dependencies updated
