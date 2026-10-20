import { after, NextResponse } from 'next/server';
import { getCheckoutStatus } from '@/lib/mpesaStatusStore';
import connect from '@/app/utils/db';
import TicketOrder from '@/app/models/TicketOrder';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import { POST as processMpesaCallback } from '../../callback/route';

const queryTimes = new Map();

function getMpesaTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

async function queryMpesaCheckout(checkoutRequestId) {
  const consumerKey = String(process.env.MPESA_CONSUMER_KEY || '').trim();
  const consumerSecret = String(process.env.MPESA_CONSUMER_SECRET || '').trim();
  const shortcode = String(process.env.MPESA_SHORTCODE || '').trim();
  const passkey = String(process.env.MPESA_PASSKEY || '').trim();
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) return null;

  const now = Date.now();
  const previousQuery = queryTimes.get(checkoutRequestId) || 0;
  if (now - previousQuery < 15000) return null;
  queryTimes.set(checkoutRequestId, now);
  if (queryTimes.size > 1000) {
    for (const [id, queriedAt] of queryTimes) {
      if (now - queriedAt > 10 * 60 * 1000) queryTimes.delete(id);
    }
  }

  const configuredBaseUrl = String(process.env.MPESA_BASE_URL || '').trim();
  const isLive = String(process.env.MPESA_ENV || '').trim().toLowerCase() === 'live';
  const baseUrl = (configuredBaseUrl || (isLive
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke')).replace(/\/$/, '');
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const tokenResponse = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    }
  );
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData?.access_token) return null;

  const timestamp = getMpesaTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const queryResponse = await fetch(
    `${baseUrl}/mpesa/stkpushquery/v1/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    }
  );
  const queryData = await queryResponse.json();
  return queryResponse.ok ? queryData : null;
}

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
      createdAt: ticketOrder.createdAt || null,
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
      createdAt: voteTx.createdAt || null,
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
      createdAt: competitionVoteTx.createdAt || null,
    };
  }

  return null;
}

export async function GET(req, context) {
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
    let dbStatus = await resolveStatusFromDb(checkoutRequestId);
    let queryConfirmedPaid = false;

    const checkoutAge = dbStatus?.createdAt
      ? Date.now() - new Date(dbStatus.createdAt).getTime()
      : 0;
    if (dbStatus?.status === 'pending' && checkoutAge >= 20000) {
      try {
        const queryResult = await queryMpesaCheckout(checkoutRequestId);
        if (Number(queryResult?.ResultCode) === 0) {
          queryConfirmedPaid = true;
          const callbackPayload = {
            Body: {
              stkCallback: {
                CheckoutRequestID: checkoutRequestId,
                ResultCode: 0,
                ResultDesc:
                  queryResult.ResultDesc || 'Payment confirmed by M-Pesa status query.',
              },
            },
          };
          after(async () => {
            const callbackRequest = new Request(
              new URL('/api/payments/mpesa/callback', req.url),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(callbackPayload),
              }
            );
            await processMpesaCallback(callbackRequest);
          });
        }
      } catch (error) {
        console.error('M-Pesa checkout status query failed:', error);
      }
    }

    const merged = {
      ...(memoryStatus || {}),
      ...(dbStatus || {}),
      checkoutRequestId,
    };
    if (queryConfirmedPaid) {
      merged.status = 'paid';
      merged.resultCode = 0;
      merged.resultDesc = 'Payment confirmed by M-Pesa.';
    }

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
