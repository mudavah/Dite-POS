import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const checks: Record<string, unknown> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy' };
  } catch (error) {
    checks.database = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
