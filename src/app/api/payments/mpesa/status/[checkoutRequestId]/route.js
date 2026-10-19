import { NextResponse } from 'next/server';
import { getCheckoutStatus } from '@/lib/mpesaStatusStore';
import connect from '@/app/utils/db';
import TicketOrder from '@/app/models/TicketOrder';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';

async function resolveStatusFromDb(checkoutRequestId) {
  await connect();

  const [ticketOrder, voteTx, competitionVoteTx] = await Promise.all([
    TicketOrder.findOne({ checkoutRequestId }).lean(),
    VotingTransaction.findOne({ checkoutRequestId }).lean(),
    CompetitionVoteTransaction.findOne({ checkoutRequestId }).lean(),
  ]);

  if (ticketOrder) {
    return {
      paymentType: 'ticket',
      status: String(ticketOrder.status || 'pending').toLowerCase(),
      resultCode: ticketOrder.resultCode,
      resultDesc:
        ticketOrder.resultDesc ||
        (ticketOrder.status === 'paid'
          ? 'Ticket payment confirmed'
          : 'Ticket payment pending'),
      mpesaReceiptNumber: ticketOrder.mpesaReceiptNumber || '',
      paidAt: ticketOrder.paidAt || null,
      ticketCode: ticketOrder.ticketCode || '',
      entryCode: ticketOrder.entryCode || '',
      ticketGenerated: Boolean(ticketOrder.ticketCode && ticketOrder.entryCode),
      eventTitle: ticketOrder.eventTitle || '',
      amount: Number(ticketOrder.totalAmount || 0),
      customerPhone: ticketOrder.customerPhone || '',
      customerEmail: ticketOrder.customerEmail || '',
    };
  }

  if (voteTx) {
    return {
      paymentType: 'vote',
      status: String(voteTx.status || 'pending').toLowerCase(),
      resultCode: voteTx.resultCode,
      resultDesc: voteTx.resultDesc || 'Vote payment pending',
      mpesaReceiptNumber: voteTx.mpesaReceiptNumber || '',
      paidAt: voteTx.paidAt || null,
      votes: Number(voteTx.votes || 0),
      campaignTitle: voteTx.campaignTitle || '',
      contestantName: voteTx.contestantName || '',
      amount: Number(voteTx.totalAmount || 0),
    };
  }

  if (competitionVoteTx) {
    return {
      paymentType: 'competition_vote',
      status: String(competitionVoteTx.status || 'pending').toLowerCase(),
      resultCode: competitionVoteTx.resultCode,
      resultDesc: competitionVoteTx.resultDesc || 'Vote payment pending',
      mpesaReceiptNumber: competitionVoteTx.mpesaReceiptNumber || '',
      paidAt: competitionVoteTx.paidAt || null,
      votes: Number(competitionVoteTx.votes || 0),
      eventTitle: competitionVoteTx.eventTitle || '',
      contestantName: competitionVoteTx.contestantName || '',
      amount: Number(competitionVoteTx.totalAmount || 0),
    };
  }

  return null;
}

export async function GET(_req, context) {
  try {
    const params = await context?.params;
    const checkoutRequestId = params?.checkoutRequestId;

    if (!checkoutRequestId) {
      return NextResponse.json(
        { success: false, message: 'Missing checkout request id' },
        { status: 400 }
      );
    }

    const memoryStatus = getCheckoutStatus(checkoutRequestId);
    const dbStatus = await resolveStatusFromDb(checkoutRequestId);

    const merged = {
      ...(memoryStatus || {}),
      ...(dbStatus || {}),
      checkoutRequestId,
    };

    if (!memoryStatus && !dbStatus) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          message: 'No checkout record found for this request id',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      found: true,
      data: merged,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load checkout status',
      },
      { status: 500 }
    );
  }
}
