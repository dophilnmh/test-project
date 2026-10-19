import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import TicketOrder from '@/app/models/TicketOrder';
import { auth } from '@/app/auth';

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function mapOrder(order) {
  return {
    id: String(order._id || ''),
    status: order.status,
    recorded: order.status === 'paid',
    eventTitle: String(order.eventTitle || '').trim(),
    tierName: String(order.tierName || '').trim(),
    quantity: Number(order.quantity || 0),
    totalAmount: Number(order.totalAmount || 0),
    customerPhone: String(order.customerPhone || '').trim(),
    ticketCode: String(order.ticketCode || '').trim(),
    entryStatus: order.entryStatus || 'unverified',
    entryVerifiedAt: order.entryVerifiedAt || null,
    mpesaReceiptNumber: String(order.mpesaReceiptNumber || '').trim(),
    checkoutRequestId: String(order.checkoutRequestId || '').trim(),
    paidAt: order.paidAt || null,
  };
}

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
    const code = normalizeCode(searchParams.get('code'));

    if (!code) {
      return NextResponse.json({
        success: true,
        recorded: false,
        matches: [],
        message: 'Enter an M-PESA transaction code to verify a ticket.',
      });
    }

    await connect();

    const orders = await TicketOrder.find({
      $or: [{ mpesaReceiptNumber: code }, { checkoutRequestId: code }],
    }).lean();

    const matches = orders.map(mapOrder);
    const paidMatches = matches.filter((item) => item.recorded);

    return NextResponse.json({
      success: true,
      recorded: paidMatches.length > 0,
      matches,
      code,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to verify code' },
      { status: 500 }
    );
  }
}
