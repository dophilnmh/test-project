import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import MerchProduct from '@/app/models/MerchProduct';
import Organizer from '@/app/models/Organizer';
import { sendMailSafe } from '@/lib/mailer';

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userRole = String(session.user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can update products' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid product id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const nextStatus = String(body?.status || '').trim();
    const nextStock = body?.stock;
    const approvalStatus = String(body?.approvalStatus || '')
      .trim()
      .toLowerCase();
    const approvalNote = String(body?.approvalNote || '').trim();
    const rawCommissionPercent = body?.commissionPercent;
    const rawImageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : null;

    if (approvalStatus === 'approved') {
      const commissionPercent = Number(rawCommissionPercent);
      if (
        rawCommissionPercent === undefined ||
        rawCommissionPercent === null ||
        String(rawCommissionPercent).trim() === '' ||
        !Number.isFinite(commissionPercent) ||
        commissionPercent < 0 ||
        commissionPercent > 100
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Enter a commission percentage from 0 to 100.',
          },
          { status: 400 }
        );
      }
    }

    const updates = {};
    if (nextStatus) {
      const allowed = ['draft', 'active', 'out_of_stock', 'archived'];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { success: false, message: 'Invalid product status' },
          { status: 400 }
        );
      }
      updates.status = nextStatus;
    }

    if (nextStock !== undefined) {
      const stock = Math.max(0, Math.floor(Number(nextStock || 0)));
      updates.stock = stock;
      if (!updates.status) {
        updates.status = stock > 0 ? 'active' : 'out_of_stock';
      }
    }

    if (rawImageUrls) {
      const imageUrls = rawImageUrls
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8);
      updates.imageUrls = imageUrls;
      updates.imageUrl = imageUrls[0] || '';
    }

    if (approvalStatus) {
      if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
        return NextResponse.json(
          { success: false, message: 'Invalid approval status' },
          { status: 400 }
        );
      }

      if (userRole !== 'superadmin') {
        return NextResponse.json(
          {
            success: false,
            message: 'Only superadmin can approve or reject products',
          },
          { status: 403 }
        );
      }

      if (approvalStatus === 'rejected' && !approvalNote) {
        return NextResponse.json(
          { success: false, message: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      updates.approvalStatus = approvalStatus;
      updates.approvalNote = approvalNote;
      updates.approvedByEmail = String(session.user.email || '').trim();
      updates.approvedAt = approvalStatus === 'approved' ? new Date() : null;

      if (approvalStatus === 'approved') {
        updates.commissionPercent = Number(rawCommissionPercent);
      }
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json(
        { success: false, message: 'No valid updates supplied' },
        { status: 400 }
      );
    }

    await connect();

    const product = await MerchProduct.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    if (updates.approvalStatus && product.createdByEmail) {
      let recipientEmail = String(product.createdByEmail || '').trim();
      if (product.organizerId) {
        const organizer = await Organizer.findById(product.organizerId)
          .select('email')
          .lean();
        if (organizer?.email) {
          recipientEmail = String(organizer.email).trim();
        }
      }

      if (recipientEmail) {
        await sendMailSafe({
          to: recipientEmail,
          subject:
            updates.approvalStatus === 'approved'
              ? 'Product approved'
              : 'Product rejected',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
              <h2>Product ${updates.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}</h2>
              <p><strong>Product:</strong> ${product.name}</p>
              <p><strong>Approval status:</strong> ${updates.approvalStatus}</p>
              ${updates.approvalNote ? `<p><strong>Reason:</strong> ${updates.approvalNote}</p>` : ''}
            </div>
          `,
          text: `Product ${product.name} is now ${updates.approvalStatus}.${updates.approvalNote ? ` Reason: ${updates.approvalNote}.` : ''}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Product updated',
      product,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update product' },
      { status: 500 }
    );
  }
}
