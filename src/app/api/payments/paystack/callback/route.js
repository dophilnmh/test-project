import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { finalizePaystackTicket } from '@/lib/paystackTicketPayment';

function redirectToEvents(request, params) {
  const url = new URL('/events', request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, String(value));
  }
  return NextResponse.redirect(url);
}

function redirectToReturnPage(request, params) {
  const requestedPath = new URL(request.url).searchParams.get('returnTo') || '';
  const path =
    requestedPath.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/events';
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, String(value));
  }
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const reference = new URL(request.url).searchParams.get('reference');
  if (!reference) {
    return redirectToEvents(request, {
      ticketPayment: 'failed',
      message: 'Missing payment reference.',
    });
  }

  try {
    const result = await finalizePaystackTicket(reference);
    if (!result.success || !result.paid) {
      if (result.paymentType && result.paymentType !== 'ticket') {
        return redirectToReturnPage(request, {
          payment: 'failed',
          message: result.message || 'Card payment was not completed.',
        });
      }
      return redirectToEvents(request, {
        ticketPayment: 'failed',
        message: result.message || 'Card payment was not completed.',
      });
    }

    if (result.paymentType && result.paymentType !== 'ticket') {
      return redirectToReturnPage(request, { payment: 'success' });
    }

    return redirectToEvents(request, {
      ticketPayment: 'success',
      ticketCode: result.order.ticketCode,
    });
  } catch (error) {
    console.error('Paystack return verification failed:', error);
    return redirectToEvents(request, {
      ticketPayment: 'failed',
      message:
        'Unable to verify the card payment. Contact support before retrying.',
    });
  }
}

export async function POST(request) {
  const secretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!secretKey) {
    return NextResponse.json({ success: false }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature') || '';
  const expected = createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    if (payload?.event === 'charge.success' && payload?.data?.reference) {
      const result = await finalizePaystackTicket(payload.data.reference);
      if (!result.success) {
        return NextResponse.json({ success: false }, { status: 502 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Paystack webhook processing failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
