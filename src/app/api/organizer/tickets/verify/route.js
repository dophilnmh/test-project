import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Organizer from '@/app/models/Organizer';
import TicketOrder from '@/app/models/TicketOrder';
import TicketVerificationAudit from '@/app/models/TicketVerificationAudit';

function normalizeText(value) {
  return String(value || '').trim();
}

function createAuditPayload({ outcome, sessionEmail, ticketCode }) {
  return {
    outcome,
    checkedAt: new Date().toISOString(),
    verifier: String(sessionEmail || '').toLowerCase(),
    ticketCode: String(ticketCode || '').toUpperCase(),
  };
}

async function persistAudit({
  organizerId,
  verifier,
  ticketCode,
  outcome,
  checkedAt,
  eventTitle = '',
  tierName = '',
  quantity = 0,
  message = '',
  requestSource = 'unknown',
}) {
  try {
    if (!organizerId || !ticketCode || !outcome) return;

    await TicketVerificationAudit.create({
      organizerId,
      verifier: String(verifier || '').toLowerCase(),
      ticketCode: String(ticketCode || '').toUpperCase(),
      outcome,
      checkedAt: checkedAt ? new Date(checkedAt) : new Date(),
      eventTitle: String(eventTitle || ''),
      tierName: String(tierName || ''),
      quantity: Math.max(0, Number(quantity || 0)),
      message: String(message || ''),
      requestSource: ['manual', 'scan'].includes(requestSource)
        ? requestSource
        : 'unknown',
    });
  } catch {}
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    await connect();

    const organizer = await Organizer.findOne({
      email: String(session.user.email).toLowerCase(),
    }).lean();

    if (!organizer) {
      return NextResponse.json(
        { success: false, message: 'Organizer account not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const ticketCode = normalizeText(body?.ticketCode).toUpperCase();
    const entryCode = normalizeText(body?.entryCode);
    const requestSource = normalizeText(body?.source).toLowerCase();

    if (!ticketCode || !entryCode) {
      const audit = createAuditPayload({
        outcome: 'missing_fields',
        sessionEmail: session.user.email,
        ticketCode,
      });

      await persistAudit({
        organizerId: organizer._id,
        verifier: audit.verifier,
        ticketCode: audit.ticketCode,
        outcome: audit.outcome,
        checkedAt: audit.checkedAt,
        message: 'Ticket code and entry code are required',
        requestSource,
      });

      return NextResponse.json(
        {
          success: false,
          errorCode: 'MISSING_FIELDS',
          message: 'Ticket code and entry code are required',
          audit,
        },
        { status: 400 }
      );
    }

    const order = await TicketOrder.findOne({
      organizerId: organizer._id,
      ticketCode,
      entryCode,
      status: 'paid',
    });

    if (!order) {
      const audit = createAuditPayload({
        outcome: 'invalid_ticket',
        sessionEmail: session.user.email,
        ticketCode,
      });

      await persistAudit({
        organizerId: organizer._id,
        verifier: audit.verifier,
        ticketCode: audit.ticketCode,
        outcome: audit.outcome,
        checkedAt: audit.checkedAt,
        message: 'Ticket not found for this organizer or code mismatch',
        requestSource,
      });

      return NextResponse.json(
        {
          success: false,
          errorCode: 'INVALID_TICKET',
          message: 'Ticket not found for this organizer or code mismatch',
          audit,
        },
        { status: 404 }
      );
    }

    if (order.entryStatus === 'verified') {
      const audit = createAuditPayload({
        outcome: 'already_used',
        sessionEmail: session.user.email,
        ticketCode: order.ticketCode,
      });

      await persistAudit({
        organizerId: organizer._id,
        verifier: audit.verifier,
        ticketCode: audit.ticketCode,
        outcome: audit.outcome,
        checkedAt: audit.checkedAt,
        eventTitle: order.eventTitle,
        tierName: order.tierName,
        quantity: Number(order.quantity || 0),
        message: 'Ticket already verified and used',
        requestSource,
      });

      return NextResponse.json(
        {
          success: false,
          errorCode: 'ALREADY_USED',
          message: 'Ticket already verified and used',
          audit,
          ticket: {
            ticketCode: order.ticketCode,
            eventTitle: order.eventTitle,
            tierName: order.tierName,
            quantity: Number(order.quantity || 0),
            verifiedAt: order.entryVerifiedAt,
          },
        },
        { status: 409 }
      );
    }

    order.entryStatus = 'verified';
    order.entryVerifiedAt = new Date();
    order.entryVerifiedBy = String(session.user.email || '').toLowerCase();
    await order.save();

    const audit = createAuditPayload({
      outcome: 'verified',
      sessionEmail: session.user.email,
      ticketCode: order.ticketCode,
    });

    await persistAudit({
      organizerId: organizer._id,
      verifier: audit.verifier,
      ticketCode: audit.ticketCode,
      outcome: audit.outcome,
      checkedAt: audit.checkedAt,
      eventTitle: order.eventTitle,
      tierName: order.tierName,
      quantity: Number(order.quantity || 0),
      message: 'Ticket verified successfully',
      requestSource,
    });

    return NextResponse.json({
      success: true,
      message: 'Ticket verified successfully',
      audit,
      ticket: {
        ticketCode: order.ticketCode,
        eventTitle: order.eventTitle,
        tierName: order.tierName,
        quantity: Number(order.quantity || 0),
        paidAt: order.paidAt,
        verifiedAt: order.entryVerifiedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to verify ticket',
      },
      { status: 500 }
    );
  }
}
