import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import { auth } from '@/app/auth';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get('limit') || 20))
    );
    const q = String(searchParams.get('q') || '').trim();

    await connect();

    const requestedStatus = String(searchParams.get('status') || 'pending')
      .trim()
      .toLowerCase();
    const status = ['pending', 'approved', 'rejected'].includes(requestedStatus)
      ? requestedStatus
      : 'pending';
    const filter = { status };

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { venue: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { organizerName: { $regex: q, $options: 'i' } },
      ];
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate(
          'organizerId',
          'organizationName contactName email phone county subCounty website description'
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to fetch pending events',
      },
      { status: 500 }
    );
  }
}
