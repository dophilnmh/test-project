import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        'Direct voting is disabled. Use paid checkout from the competition page.',
    },
    { status: 405 }
  );
}
