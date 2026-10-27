import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import connect from '@/app/utils/db';
import FundRequest from '@/app/models/FundRequest';
import FundApprovalToken from '@/app/models/FundApprovalToken';
import { sendMailSafe } from '@/lib/mailer';
import { createFundReceiptPdf } from '@/lib/fundReceipt';

function hashToken(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function htmlResponse(title, message, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,sans-serif;max-width:520px;margin:48px auto;padding:24px;line-height:1.6"><h1>${title}</h1><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function finalizeIfReady(requestId) {
  const request = await FundRequest.findById(requestId);
  if (!request) return null;

  const tokens = await FundApprovalToken.find({ requestId }).lean();
  const approvedCount = tokens.filter((item) => item.approvedAt).length;

  request.emailApprovalCompleted = approvedCount;

  if (approvedCount >= Number(request.emailApprovalRequired || 1)) {
    request.status = 'approved';
    request.emailApprovalCompletedAt = new Date();
    await request.save();

    const organizerEmail = String(request.organizerEmail || '').trim();
    if (organizerEmail) {
      await sendMailSafe({
        to: organizerEmail,
        subject: 'Fund request approved after email verification',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
            <h2>Fund Request Approved</h2>
            <p><strong>Organizer:</strong> ${request.organizerName}</p>
            <p><strong>Payout amount:</strong> ${request.amount}</p>
            <p><strong>M-PESA transaction cost:</strong> ${request.transactionCost || 0}</p>
            <p><strong>Total deducted from available funds:</strong> ${Number(request.amount || 0) + Number(request.transactionCost || 0)}</p>
            <p><strong>Status:</strong> ${request.status}</p>
            <p>Your request is approved for payout processing. The approval receipt is attached as a PDF.</p>
          </div>
        `,
        text: `Your fund request amount ${request.amount} is approved for payout processing. The approval receipt is attached as a PDF.`,
        attachments: [
          {
            filename: `fund-approval-receipt-${String(request._id).slice(-8)}.pdf`,
            content: createFundReceiptPdf(request),
            contentType: 'application/pdf',
          },
        ],
      });
    }
  } else {
    request.status = 'pending_email_approval';
    await request.save();
  }

  return request;
}

export async function GET(req) {
  try {
    const token = String(req.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Approval token is required' },
        { status: 400 }
      );
    }

    await connect();

    const tokenHash = hashToken(token);
    const record = await FundApprovalToken.findOne({ tokenHash });

    if (!record) {
      return NextResponse.json(
        { success: false, message: 'Invalid approval token' },
        { status: 404 }
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return htmlResponse(
        'Approval expired',
        'This fund approval link has expired.',
        400
      );
    }

    if (record.approvedAt) {
      return htmlResponse(
        'Already approved',
        'This approval link has already been used.'
      );
    }

    return new Response(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fund approval</title></head><body style="font-family:Arial,sans-serif;max-width:520px;margin:48px auto;padding:24px;line-height:1.6"><h1>Confirm fund approval</h1><p>Enter the six-digit OTP sent to the superadmin account email.</p><form method="post"><input type="hidden" name="token" value="${token}"><label for="otp">OTP</label><br><input id="otp" name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autofocus style="font-size:24px;letter-spacing:6px;padding:10px;width:180px;margin:12px 0"><br><button type="submit" style="padding:10px 18px;cursor:pointer">Approve fund request</button></form></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    return htmlResponse(
      'Unable to confirm approval',
      error.message || 'Please try again.',
      500
    );
  }
}

export async function POST(req) {
  try {
    const isJson = req.headers
      .get('content-type')
      ?.includes('application/json');
    const body = isJson
      ? await req.json()
      : Object.fromEntries(await req.formData());
    const token = String(body?.token || '').trim();
    const otp = String(body?.otp || '').trim();

    if (!token || !/^\d{6}$/.test(otp)) {
      if (isJson) {
        return NextResponse.json(
          { success: false, message: 'Enter the six-digit OTP.' },
          { status: 400 }
        );
      }
      return htmlResponse(
        'Invalid OTP',
        'Enter the six-digit OTP from the superadmin account email.',
        400
      );
    }

    await connect();
    const record = await FundApprovalToken.findOne({
      tokenHash: hashToken(token),
    });
    if (!record || record.approvedAt) {
      if (isJson) {
        return NextResponse.json(
          {
            success: false,
            message: 'This approval request is invalid or already used.',
          },
          { status: 400 }
        );
      }
      return htmlResponse(
        'Invalid approval link',
        'This approval link is invalid or has already been used.',
        400
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      if (isJson) {
        return NextResponse.json(
          { success: false, message: 'This approval request has expired.' },
          { status: 400 }
        );
      }
      return htmlResponse(
        'Approval expired',
        'This fund approval link has expired.',
        400
      );
    }

    if (hashToken(otp) !== record.otpHash) {
      if (isJson) {
        return NextResponse.json(
          { success: false, message: 'The OTP is incorrect.' },
          { status: 400 }
        );
      }
      return htmlResponse(
        'Invalid OTP',
        'The OTP is incorrect. Check the superadmin account email and try again.',
        400
      );
    }

    record.approvedAt = new Date();
    await record.save();

    const request = await finalizeIfReady(record.requestId);

    if (isJson) {
      return NextResponse.json({
        success: true,
        message:
          request?.status === 'approved'
            ? 'Fund request approved and organizer notified.'
            : 'Approval recorded.',
        request: request?.toObject?.() || request,
      });
    }

    return htmlResponse(
      request?.status === 'approved'
        ? 'Fund request approved'
        : 'Approval recorded',
      request?.status === 'approved'
        ? 'The fund request is now approved and the organizer has been notified.'
        : 'Approval recorded. Waiting for the remaining approval.'
    );
  } catch (error) {
    return htmlResponse(
      'Unable to confirm approval',
      error.message || 'Please try again.',
      500
    );
  }
}
