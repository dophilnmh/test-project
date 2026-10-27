import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import connect from '@/app/utils/db';
import FundRequest from '@/app/models/FundRequest';
import FundApprovalToken from '@/app/models/FundApprovalToken';
import User from '@/app/models/User';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';
import { createFundReceiptPdf } from '@/lib/fundReceipt';

function hashToken(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function appBaseUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

async function resolveApproverEmail() {
  const superadmin = await User.findOne({ role: 'superadmin' })
    .select('email notificationEmailEnabled')
    .lean();

  if (superadmin?.email && superadmin.notificationEmailEnabled !== false) {
    return normalizeEmail(superadmin.email);
  }

  return '';
}

async function sendCompletionNotifications(request, status, reviewNote) {
  const organizerEmail = String(request.organizerEmail || '').trim();
  const superadmins = await User.find({ role: 'superadmin' })
    .select('email notificationEmailEnabled')
    .lean();

  const recipients = superadmins
    .filter((item) => item?.email && item.notificationEmailEnabled !== false)
    .map((item) => normalizeEmail(item.email));

  const messageLabel = status === 'approved' ? 'approved' : 'rejected';
  const attachments =
    status === 'approved'
      ? [
          {
            filename: `fund-approval-receipt-${String(request._id).slice(-8)}.pdf`,
            content: createFundReceiptPdf(request),
            contentType: 'application/pdf',
          },
        ]
      : undefined;

  const jobs = [];

  if (organizerEmail) {
    jobs.push(
      sendMailSafe({
        to: organizerEmail,
        subject:
          status === 'approved'
            ? 'Fund request approved'
            : 'Fund request rejected',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
            <h2>Fund Request ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
            <p><strong>Organizer:</strong> ${request.organizerName}</p>
            <p><strong>Payout amount:</strong> ${request.amount}</p>
            <p><strong>M-PESA transaction cost:</strong> ${request.transactionCost || 0}</p>
            <p><strong>Total deducted from available funds:</strong> ${Number(request.amount || 0) + Number(request.transactionCost || 0)}</p>
            ${request.accountName ? `<p><strong>Account Name:</strong> ${request.accountName}</p>` : ''}
            <p><strong>Status:</strong> ${request.status}</p>
            ${request.requestPurpose ? `<p><strong>Purpose:</strong> ${request.requestPurpose}</p>` : ''}
            ${reviewNote ? `<p><strong>Reason/Note:</strong> ${reviewNote}</p>` : ''}
          </div>
        `,
        text: `Your fund request for ${request.amount} plus transaction cost ${request.transactionCost || 0} has been ${messageLabel}. Status: ${request.status}.${reviewNote ? ` Note: ${reviewNote}.` : ''}`,
        attachments,
      })
    );
  }

  for (const email of recipients) {
    jobs.push(
      sendMailSafe({
        to: email,
        subject: `Fund request ${messageLabel}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
            <h2>Fund Request ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
            <p><strong>Organizer:</strong> ${request.organizerName}</p>
            <p><strong>Payout amount:</strong> ${request.amount}</p>
            <p><strong>M-PESA transaction cost:</strong> ${request.transactionCost || 0}</p>
            <p><strong>Status:</strong> ${request.status}</p>
          </div>
        `,
        text: `Fund request for ${request.organizerName} was ${messageLabel}. Amount: ${request.amount}.`,
        attachments,
      })
    );
  }

  await Promise.allSettled(jobs);
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

    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    await connect();

    const requests = await FundRequest.find({}).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load requests' },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
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

    const body = await req.json();
    const requestId = String(body?.requestId || '').trim();
    const status = body?.status === 'rejected' ? 'rejected' : 'approved';
    const reviewNote = String(body?.reviewNote || '').trim();

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: 'Request id is required' },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !reviewNote) {
      return NextResponse.json(
        { success: false, message: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    await connect();

    const request = await FundRequest.findById(requestId);
    if (!request) {
      return NextResponse.json(
        { success: false, message: 'Fund request not found' },
        { status: 404 }
      );
    }

    request.reviewedByName = String(session.user.name || '').trim();
    request.reviewedByEmail = String(session.user.email || '').trim();
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote;

    if (status === 'rejected') {
      request.status = 'rejected';
      request.emailApprovalRequired = 0;
      request.emailApprovalCompleted = 0;
      request.emailApprovalSummary = [];
      request.emailApprovalRequestedAt = null;
      request.emailApprovalCompletedAt = null;
      await request.save();

      await FundApprovalToken.deleteMany({ requestId: request._id });
      await sendCompletionNotifications(request, 'rejected', reviewNote);

      return NextResponse.json({
        success: true,
        message: 'Fund request rejected',
        request: request.toObject(),
      });
    }

    const approverEmail = await resolveApproverEmail();
    if (!approverEmail) {
      return NextResponse.json(
        {
          success: false,
          message:
            'No active superadmin email exists for fund approval OTP delivery.',
        },
        { status: 400 }
      );
    }

    await FundApprovalToken.deleteMany({ requestId: request._id });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashToken(otp);

    await FundApprovalToken.create({
      requestId: request._id,
      approverEmail,
      approverLabel: 'Superadmin',
      tokenHash,
      otpHash,
      expiresAt,
    });

    request.status = 'pending_email_approval';
    request.emailApprovalRequired = 1;
    request.emailApprovalCompleted = 0;
    request.emailApprovalSummary = [approverEmail];
    request.emailApprovalRequestedAt = new Date();
    request.emailApprovalCompletedAt = null;
    await request.save();

    const approvalLink = `${appBaseUrl()}/api/admin/fund-requests/confirm?token=${rawToken}`;

    await sendMailSafe({
      to: approverEmail,
      subject: 'Fund approval OTP required',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
          <h2>Fund Request Approval Required</h2>
          <p><strong>Organizer:</strong> ${request.organizerName}</p>
          <p><strong>Amount:</strong> ${request.amount}</p>
          <p><strong>M-PESA Number:</strong> ${request.mpesaNumber}</p>
          ${request.accountName ? `<p><strong>Account Name:</strong> ${request.accountName}</p>` : ''}
          ${request.requestPurpose ? `<p><strong>Purpose:</strong> ${request.requestPurpose}</p>` : ''}
          ${reviewNote ? `<p><strong>Admin Note:</strong> ${reviewNote}</p>` : ''}
          <p><strong>Approval OTP:</strong> <span style="font-size:24px;letter-spacing:4px;font-weight:bold;">${otp}</span></p>
          <p>Please approve this request using the secure link below:</p>
          <p><a href="${approvalLink}">${approvalLink}</a></p>
          <p>This OTP and link expire in 24 hours.</p>
        </div>
      `,
      text: `Fund approval required for ${request.organizerName}, amount ${request.amount}. Approval OTP: ${otp}. Approve using: ${approvalLink}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Fund request sent for superadmin OTP verification.',
      approvalToken: rawToken,
      approverEmail,
      request: request.toObject(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update request' },
      { status: 500 }
    );
  }
}
