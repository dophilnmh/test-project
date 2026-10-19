import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import connect from '@/app/utils/db';
import MerchOrder from '@/app/models/MerchOrder';
import MerchProduct from '@/app/models/MerchProduct';

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const reference = String(body.reference || '').trim();
    if (!reference) {
      return NextResponse.json(
        { success: false, message: 'Payment reference is required.' },
        { status: 400 }
      );
    }

    await connect();
    const order = await MerchOrder.findOneAndUpdate(
      {
        paymentReference: reference,
        buyerEmail: session.user.email,
        paymentStatus: 'pending',
      },
      { $set: { paymentStatus: 'failed' } },
      { new: true }
    );
    if (order) {
      const product = await MerchProduct.findByIdAndUpdate(
        order.productId,
        { $inc: { stock: order.quantity } },
        { new: true }
      );
      if (product?.status === 'out_of_stock' && product.stock > 0) {
        product.status = 'active';
        await product.save();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Paystack cancellation failed:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to release the reserved order.' },
      { status: 500 }
    );
  }
}
