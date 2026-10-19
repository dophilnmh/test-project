import { NextResponse } from 'next/server';
import { sendMailSafe } from '@/lib/mailer';
import { buildTicketPdfBuffer, buildTicketQrPayload } from '@/lib/ticketing';

const DEFAULT_TEST_EMAIL =
  process.env.BACKUP_EMAIL_TO || 'obotemusa3@gmail.com';

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = normalizeEmail(
      searchParams.get('email') || DEFAULT_TEST_EMAIL
    );

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'A valid email address is required, e.g. ?email=you@example.com',
        },
        { status: 400 }
      );
    }

    return await sendDebugTicketEmail(email);
  } catch (error) {
    console.error('Debug ticket email failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to send debug ticket email',
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email || DEFAULT_TEST_EMAIL);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: 'A valid email address is required.',
        },
        { status: 400 }
      );
    }

    return await sendDebugTicketEmail(
      email,
      body?.ticketCode || 'DEBUG-TICKET-001'
    );
  } catch (error) {
    console.error('Debug ticket email POST failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to send debug ticket email',
      },
      { status: 500 }
    );
  }
}

async function sendDebugTicketEmail(email, ticketCode = 'DEBUG-TICKET-001') {
  const fakeOrder = {
    _id: 'debug-ticket-order',
    ticketCode,
    entryCode: '123456',
    tierName: 'VIP',
    quantity: 1,
    totalAmount: 2500,
    customerPhone: '0712345678',
    customerEmail: email,
    mpesaReceiptNumber: 'TEST-DEBUG-0001',
    eventTitle: 'Debug Ticket Test Event',
  };

  const fakeEvent = {
    title: 'Debug Ticket Test Event',
    organizerName: 'NimblyPolls',
  };

  const qrPayload = buildTicketQrPayload({
    ticketCode: fakeOrder.ticketCode,
    entryCode: fakeOrder.entryCode,
  });

  const pdfBuffer = await buildTicketPdfBuffer({
    order: fakeOrder,
    event: fakeEvent,
    issuedAt: new Date(),
    customerEmail: email,
  });

  const emailResult = await sendMailSafe({
    to: email,
    subject: 'Debug Ticket Email Test - NimblyPolls',
    text: `This is a debug test ticket email. Ticket code: ${fakeOrder.ticketCode}. Entry code: ${fakeOrder.entryCode}. QR payload: ${qrPayload}`,
    html: `
      <div style="font-family:Arial,sans-serif; line-height:1.6; color:#111; max-width:600px; margin:0 auto; padding:24px;">
        <h2 style="color:#2563eb; margin-bottom:12px;">Debug Ticket Email Test</h2>
        <p>This email was sent manually from the app to verify ticket delivery.</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0;">
          <p><strong>Event:</strong> ${fakeEvent.title}</p>
          <p><strong>Ticket Code:</strong> ${fakeOrder.ticketCode}</p>
          <p><strong>Entry Code:</strong> ${fakeOrder.entryCode}</p>
          <p><strong>Tier:</strong> ${fakeOrder.tierName}</p>
          <p><strong>Amount:</strong> KES ${Number(fakeOrder.totalAmount || 0).toLocaleString()}</p>
          <p><strong>QR:</strong> ${qrPayload}</p>
        </div>
        <p style="font-size:14px; color:#475569;">This confirms the app can generate and send a ticket email with a PDF attachment.</p>
      </div>
    `,
    attachments: [
      {
        filename: `${String(fakeOrder.ticketCode || 'debug-ticket').toLowerCase()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log('🧪 DEBUG TICKET EMAIL RESULT:', {
    email,
    ticketCode,
    ok: emailResult?.ok,
    accepted: emailResult?.accepted,
    rejected: emailResult?.rejected,
    message: emailResult?.message,
    messageId: emailResult?.messageId,
  });

  if (!emailResult?.ok) {
    return NextResponse.json(
      {
        success: false,
        message: emailResult?.message || 'Debug ticket email failed to send.',
        details: emailResult,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Debug ticket email sent successfully to ${email}.`,
    email,
    ticketCode,
    result: emailResult,
  });
}
