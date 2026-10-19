import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import MerchProduct from '@/app/models/MerchProduct';
import BlogPost from '@/app/models/BlogPost';
import FundRequest from '@/app/models/FundRequest';

function toIso(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
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

    if (String(session.user.role || '').toLowerCase() !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    await connect();

    const [
      pendingProducts,
      pendingBlogs,
      pendingFunds,
      recentProducts,
      recentBlogs,
      recentFunds,
    ] = await Promise.all([
      MerchProduct.find({ approvalStatus: 'pending' })
        .sort({ createdAt: -1 })
        .lean(),
      BlogPost.find({ status: 'pending_approval' })
        .sort({ createdAt: -1 })
        .lean(),
      FundRequest.find({
        status: { $in: ['pending', 'pending_email_approval'] },
      })
        .sort({ createdAt: -1 })
        .lean(),
      MerchProduct.find({ approvalStatus: { $in: ['approved', 'rejected'] } })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
      BlogPost.find({
        status: { $in: ['published', 'rejected', 'archived', 'draft'] },
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
      FundRequest.find({ status: { $in: ['approved', 'rejected'] } })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      pending: {
        products: pendingProducts,
        blogs: pendingBlogs,
        funds: pendingFunds,
      },
      recentAudit: {
        products: recentProducts.map((item) => ({
          id: String(item._id),
          type: 'product',
          title: item.name,
          state: item.approvalStatus,
          actor: item.approvedByEmail || item.createdByEmail || '',
          note: item.approvalNote || '',
          at: toIso(item.approvedAt || item.updatedAt),
        })),
        blogs: recentBlogs.map((item) => ({
          id: String(item._id),
          type: 'blog',
          title: item.title,
          state: item.status,
          actor: item.approvedByEmail || item.createdByEmail || '',
          note: item.rejectionReason || '',
          at: toIso(item.approvedAt || item.publishedAt || item.updatedAt),
        })),
        funds: recentFunds.map((item) => ({
          id: String(item._id),
          type: 'fund',
          title: `${item.organizerName} - ${item.amount}`,
          state: item.status,
          actor: item.reviewedByEmail || '',
          note: item.reviewNote || '',
          at: toIso(
            item.reviewedAt || item.emailApprovalCompletedAt || item.updatedAt
          ),
        })),
      },
      totals: {
        pendingProducts: pendingProducts.length,
        pendingBlogs: pendingBlogs.length,
        pendingFunds: pendingFunds.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load superadmin approval inbox',
      },
      { status: 500 }
    );
  }
}
