import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import MerchProduct from '@/app/models/MerchProduct';
import MerchOrder from '@/app/models/MerchOrder';
import Organizer from '@/app/models/Organizer';
import User from '@/app/models/User';
import Event from '@/app/models/Event';

function resolveCommissionPercent(superadmin) {
  const configured = Number(superadmin?.merchandiseCommissionPercent);
  if (Number.isFinite(configured)) {
    return Math.min(100, Math.max(0, configured));
  }

  const fromEnv = Number(process.env.MERCH_PLATFORM_COMMISSION_PERCENT || 15);
  if (Number.isFinite(fromEnv)) {
    return Math.min(100, Math.max(0, fromEnv));
  }

  return 15;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    await connect();

    const role = session.user.role;
    let filter = {};
    if (role === 'admin' || role === 'superadmin') {
      filter = {};
    } else if (role === 'organizer') {
      const organizer = await Organizer.findOne({
        email: String(session.user.email || '')
          .trim()
          .toLowerCase(),
      })
        .select('_id')
        .lean();
      filter = organizer?._id ? { organizerId: organizer._id } : { _id: null };
    } else {
      filter = { buyerEmail: session.user.email || '' };
    }

    const orders = await MerchOrder.find(filter).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load merchandise orders',
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Login required to place an order' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const productId = String(body?.productId || '').trim();
    const quantity = Math.max(1, Math.floor(Number(body?.quantity || 1)));
    const buyerPhone = String(body?.buyerPhone || '').trim();
    const deliveryLocation = String(body?.deliveryLocation ?? '');
    const notes = String(body?.notes || '').trim();

    if (!productId || !deliveryLocation.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Product and delivery location are required',
        },
        { status: 400 }
      );
    }

    await connect();

    const product = await MerchProduct.findOneAndUpdate(
      {
        _id: productId,
        status: 'active',
        approvalStatus: 'approved',
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
      { new: true }
    );

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product unavailable or out of stock' },
        { status: 409 }
      );
    }

    if (product.stock <= 0) {
      product.status = 'out_of_stock';
      await product.save();
    }

    const totalAmount = Number(product.price || 0) * quantity;
    const superadmin = await User.findOne({ role: 'superadmin' })
      .select('merchandiseCommissionPercent')
      .lean();
    const event = product.eventId
      ? await Event.findById(product.eventId).select('commercialTerms').lean()
      : null;
    const commissionPercent = Number(
      product.commissionPercent ??
        event?.commercialTerms?.merchandiseCommissionPercent ??
        resolveCommissionPercent(superadmin)
    );
    const platformCommissionAmount = Math.round(
      totalAmount * (commissionPercent / 100)
    );
    const organizerEarningsAmount = Math.max(
      0,
      totalAmount - platformCommissionAmount
    );

    const order = await MerchOrder.create({
      productId: product._id,
      organizerId: product.organizerId || null,
      organizerName: product.organizerName || '',
      productName: product.name,
      unitPrice: product.price,
      quantity,
      totalAmount,
      commissionPercent,
      platformCommissionAmount,
      organizerEarningsAmount,
      currency: 'KSH',
      buyerEmail: session.user.email,
      buyerName: session.user.name || '',
      buyerPhone,
      deliveryLocation,
      notes,
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      message: 'Order placed successfully. Admin will confirm fulfillment.',
      order,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to place merchandise order',
      },
      { status: 500 }
    );
  }
}
