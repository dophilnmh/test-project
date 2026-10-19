import { NextResponse } from 'next/server';
import { finalizePaystackTicket } from '@/lib/paystackTicketPayment';

export async function POST(request) {
  try {
    const body = await request.json();
    const reference = String(body.reference || '').trim();
    if (!reference) {
      return NextResponse.json(
        { success: false, message: 'Payment reference is required.' },
        { status: 400 }
      );
    }

    const result = await finalizePaystackTicket(reference);
    if (!result.success || !result.paid) {
      return NextResponse.json(
        {
          success: false,
          paid: false,
          message: result.message || 'Card payment could not be verified.',
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      paid: true,
      ticketCode: result.order.ticketCode,
    });
  } catch (error) {
    console.error('Paystack verification request failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to verify card payment right now.',
      },
      { status: 500 }
    );
  }
}
