import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await connect();

    return NextResponse.json(
      {
        ok: true,
        service: 'mongodb',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'mongodb',
        error: 'Database connection failed',
        name: error?.name || 'Error',
        code: error?.code || null,
        details: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
