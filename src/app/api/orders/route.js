import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import TicketOrder from '@/app/models/TicketOrder';
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

    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can view all orders' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get('limit') || 25))
    );
    const q = String(searchParams.get('q') || '').trim();
    const status = String(searchParams.get('status') || 'all').trim();

    await connect();

    const filter = {};

    if (status !== 'all') {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { eventTitle: { $regex: q, $options: 'i' } },
        { tierName: { $regex: q, $options: 'i' } },
        { referralContestantName: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q, $options: 'i' } },
        { customerEmail: { $regex: q, $options: 'i' } },
      ];
    }

    const [orders, total] = await Promise.all([
      TicketOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('eventId', 'title')
        .lean(),
      TicketOrder.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load orders' },
      { status: 500 }
    );
  }
}
