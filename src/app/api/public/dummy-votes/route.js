import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import DummyVoteAdjustment from '@/app/models/DummyVoteAdjustment';

export async function GET(req) {
  try {
    const targetType = String(req.nextUrl.searchParams.get('targetType') || '')
      .trim()
      .toLowerCase();
    const targetId = String(
      req.nextUrl.searchParams.get('targetId') || ''
    ).trim();

    if (!['competition_event', 'campaign_vote'].includes(targetType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid target type' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid target id' },
        { status: 400 }
      );
    }

    await connect();

    const rows = await DummyVoteAdjustment.find({
      targetType,
      targetId,
      dummyVotes: { $gt: 0 },
    }).lean();

    const map = {};
    for (const row of rows) {
      const key = String(row?.contestantKey || '')
        .trim()
        .toLowerCase();
      if (!key) continue;
      map[key] = Math.max(0, Number(row?.dummyVotes || 0));
    }

    return NextResponse.json({
      success: true,
      targetType,
      targetId,
      adjustments: map,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load dummy vote adjustments',
      },
      { status: 500 }
    );
  }
}
