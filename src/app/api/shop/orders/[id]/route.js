import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import MerchOrder from '@/app/models/MerchOrder';

export async function PATCH(req, { params }) {
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
        { success: false, message: 'Only admins can update order status' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid order id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const nextStatus = String(body?.status || '').trim();
    const allowed = [
      'pending',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
    ];

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { success: false, message: 'Invalid order status' },
        { status: 400 }
      );
    }

    await connect();

    const order = await MerchOrder.findByIdAndUpdate(
      id,
      { status: nextStatus },
      { new: true }
    ).lean();

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Order moved to ${nextStatus}`,
      order,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update order' },
      { status: 500 }
    );
  }
}
