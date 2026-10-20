// /app/api/payments/mpesa/route.js

import { NextResponse } from 'next/server';
import { initCheckoutStatus, setCheckoutStatus } from '@/lib/mpesaStatusStore';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import TicketOrder from '@/app/models/TicketOrder';
import VotingCampaign from '@/app/models/VotingCampaign';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import User from '@/app/models/User';
import { createTicketCode, createEntryCode } from '@/lib/ticketing';
import { resolveTicketReferral } from '@/lib/ticketReferral';

function normalizePhone(phone) {
  const trimmed = String(phone || '').replace(/\s+/g, '');
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  return null;
}

function normalizeTierName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

function normalizeContestantKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function resolveVotingCommissionPercent(superadmin) {
  const configured = Number(superadmin?.votingCommissionPercent);
  if (Number.isFinite(configured)) {
    return Math.min(100, Math.max(0, configured));
  }

  const fromEnv = Number(process.env.VOTING_PLATFORM_COMMISSION_PERCENT || 20);
  if (Number.isFinite(fromEnv)) {
    return Math.min(100, Math.max(0, fromEnv));
  }

  return 20;
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function sanitizeMpesaField(value, fallback, maxLen = 40) {
  const raw = String(value || fallback || '');
  const sanitized = raw
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (sanitized || String(fallback || '')).slice(0, maxLen);
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function hasMpesaConfig() {
  return (
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_CALLBACK_URL
  );
}

function resolveMpesaRuntimeConfig() {
  const baseUrlFromEnv = String(process.env.MPESA_BASE_URL || '').trim();
  const envMode = String(process.env.MPESA_ENV || '')
    .trim()
    .toLowerCase();

  const baseUrl = baseUrlFromEnv
    ? baseUrlFromEnv
    : envMode === 'live'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  const isSandboxBaseUrl = /sandbox\.safaricom\.co\.ke/i.test(baseUrl);
  const isLiveBaseUrl = /api\.safaricom\.co\.ke/i.test(baseUrl);

  const mode = isSandboxBaseUrl
    ? 'sandbox'
    : envMode === 'live' || (!envMode && isLiveBaseUrl)
      ? 'live'
      : 'sandbox';

  const transactionTypeEnv = String(
    process.env.MPESA_STK_TRANSACTION_TYPE || ''
  )
    .trim()
    .toLowerCase();

  const isTillTransaction =
    transactionTypeEnv === 'till' ||
    transactionTypeEnv === 'buygoods' ||
    transactionTypeEnv === 'buy_goods';

  const transactionType =
    mode === 'sandbox'
      ? 'CustomerPayBillOnline'
      : isTillTransaction
        ? 'CustomerBuyGoodsOnline'
        : 'CustomerPayBillOnline';

  const partyB =
    mode === 'sandbox'
      ? process.env.MPESA_SHORTCODE || '174379'
      : isTillTransaction
        ? process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE
        : process.env.MPESA_SHORTCODE;

  return {
    mode,
    baseUrl,
    transactionType,
    partyB,
  };
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getAccessToken(baseUrl) {
  const credentials = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  let response;
  try {
    response = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: { Authorization: `Basic ${credentials}` },
        cache: 'no-store',
      }
    );
  } catch (error) {
    throw new Error(`Unable to reach M-Pesa auth service: ${error.message}`);
  }

  const data = await readResponseBody(response);
  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.errorMessage || data?.raw || 'Failed to get M-Pesa access token'
    );
  }

  return data.access_token;
}

function calcVoteAmount(campaign, packageId, packageName, quantity) {
  const votePackage = (campaign.votingPackages || []).find(
    (item) =>
      String(item._id) === String(packageId || '') ||
      String(item.name).toLowerCase() ===
        String(packageName || '').toLowerCase()
  );

  if (!votePackage) return null;

  const packageUnits = Math.max(1, Math.round(Number(quantity || 1)));
  const packageVotes = Math.max(1, Number(votePackage.votes || 1));
  const packagePrice = Math.max(0, Math.round(Number(votePackage.price || 0)));

  return {
    votePackage,
    packageUnits,
    votes: packageVotes * packageUnits,
    unitPrice: packagePrice,
    amount: packagePrice * packageUnits,
  };
}

function calcRequestedVotesAmount(votePackage, requestedVotes) {
  const pkgVotes = Math.max(1, Number(votePackage?.votes || 1));
  const pkgPrice = Math.max(0, Number(votePackage?.price || 0));
  const unitVotePrice = pkgPrice / pkgVotes;
  const safeRequestedVotes = Math.max(
    1,
    Math.round(Number(requestedVotes || 1))
  );

  return {
    votes: safeRequestedVotes,
    unitPrice: Math.round(unitVotePrice),
    amount: Math.max(1, Math.round(unitVotePrice * safeRequestedVotes)),
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const rawPaymentType = String(body.paymentType || 'ticket')
      .trim()
      .toLowerCase();
    const paymentType =
      rawPaymentType === 'campaign_vote' || rawPaymentType === 'voting'
        ? 'vote'
        : rawPaymentType;
    const phone = normalizePhone(body.phone);
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: 'Use a valid Safaricom number e.g. 07XXXXXXXX',
        },
        { status: 400 }
      );
    }

    if (paymentType === 'ticket') {
      if (!email) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Email is required before buying a ticket. We send the ticket and QR code to your email.',
          },
          { status: 400 }
        );
      }

      if (!emailPattern.test(email)) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Enter a valid email address to receive your ticket details.',
          },
          { status: 400 }
        );
      }
    }

    await connect();

    const superadmin = await User.findOne({ role: 'superadmin' })
      .select('votingCommissionPercent')
      .lean();
    const votingCommissionPercent = resolveVotingCommissionPercent(superadmin);

    let meta = { paymentType, customerEmail: email };
    let amount = 0;

    if (paymentType === 'vote') {
      const campaignId = String(body.campaignId || body.eventId || '').trim();
      const contestantId = String(body.contestantId || '').trim();
      const packageId = String(body.packageId || '').trim();
      const packageName = String(body.packageName || '').trim();
      const requestedVotes = Number(body.requestedVotes || 0);

      const campaign = await VotingCampaign.findById(campaignId);
      if (!campaign || campaign.status !== 'live') {
        return NextResponse.json(
          {
            success: false,
            message: 'Voting campaign not available for checkout',
          },
          { status: 404 }
        );
      }

      const contestant = (campaign.contestants || campaign.nominees || []).find(
        (item) => String(item._id) === contestantId
      );
      if (!contestant) {
        return NextResponse.json(
          { success: false, message: 'Selected contestant not found' },
          { status: 404 }
        );
      }

      const maxVotesPerTxn = Math.max(
        1,
        Math.round(Number(campaign.maxVotesPerVoter || 1000))
      );
      if (requestedVotes > maxVotesPerTxn) {
        return NextResponse.json(
          {
            success: false,
            message: `Maximum allowed votes per transaction is ${maxVotesPerTxn}`,
          },
          { status: 400 }
        );
      }

      const voteAmount = calcVoteAmount(
        campaign,
        packageId,
        packageName,
        Number(body.quantity || 1)
      );
      if (!voteAmount) {
        return NextResponse.json(
          { success: false, message: 'Selected voting package not found' },
          { status: 400 }
        );
      }

      const requestedVoteAmount =
        requestedVotes > 0
          ? calcRequestedVotesAmount(voteAmount.votePackage, requestedVotes)
          : null;

      amount = requestedVoteAmount?.amount || voteAmount.amount;
      meta = {
        ...meta,
        paymentType: 'vote',
        campaignId: String(campaign._id),
        campaignTitle: campaign.title,
        organizerId: campaign.organizerId ? String(campaign.organizerId) : '',
        organizerName: campaign.organizerName || '',
        contestantId,
        contestantName: contestant.name,
        packageId: String(voteAmount.votePackage._id),
        packageName: voteAmount.votePackage.name,
        packageUnits: voteAmount.packageUnits,
        votes: requestedVoteAmount?.votes || voteAmount.votes,
        unitPrice: requestedVoteAmount?.unitPrice || voteAmount.unitPrice,
        commissionPercent: Number(
          campaign.commissionPercent ?? votingCommissionPercent
        ),
      };
    } else if (paymentType === 'competition_vote') {
      const eventId = String(body.eventId || '').trim();
      const contestantKey = normalizeContestantKey(
        body.contestantKey || body.contestantId
      );
      const packageId = String(body.packageId || '').trim();
      const packageName = String(body.packageName || '').trim();
      const requestedVotes = Number(body.requestedVotes || 0);

      if (!eventId || !contestantKey) {
        return NextResponse.json(
          {
            success: false,
            message: 'Competition event and contestant are required',
          },
          { status: 400 }
        );
      }

      const event = await Event.findById(eventId);
      if (
        !event ||
        event.status !== 'approved' ||
        event.eventType !== 'competition'
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Competition event not available for checkout',
          },
          { status: 404 }
        );
      }

      const maxCompetitionVotesPerTxn = Math.max(
        1,
        Math.round(Number(event.competition?.maxVotesPerTransaction || 1000))
      );

      if (requestedVotes > maxCompetitionVotesPerTxn) {
        return NextResponse.json(
          {
            success: false,
            message: `Maximum allowed votes per transaction is ${maxCompetitionVotesPerTxn}`,
          },
          { status: 400 }
        );
      }

      const votePackage = (event.competition?.votePackages || []).find(
        (item) =>
          item?.isActive !== false &&
          (String(item._id || '') === packageId ||
            String(item.name || '').toLowerCase() === packageName.toLowerCase())
      );

      if (!votePackage) {
        return NextResponse.json(
          {
            success: false,
            message: 'Selected vote package not found for this competition',
          },
          { status: 400 }
        );
      }

      const now = Date.now();
      if (new Date(event.startDateTime).getTime() > now) {
        return NextResponse.json(
          { success: false, message: 'Voting has not started yet' },
          { status: 400 }
        );
      }

      if (new Date(event.endDateTime).getTime() < now) {
        return NextResponse.json(
          { success: false, message: 'Voting for this competition has ended' },
          { status: 400 }
        );
      }

      const contestants = event.competition?.contestants || [];
      const contestant = contestants.find((item) => {
        const key = `${String(item?.fullName || '')
          .trim()
          .toLowerCase()}::${String(item?.category || '')
          .trim()
          .toLowerCase()}`;
        return key === contestantKey;
      });

      if (!contestant) {
        return NextResponse.json(
          { success: false, message: 'Selected contestant not found' },
          { status: 404 }
        );
      }

      const packageUnits = Math.max(1, Math.round(Number(body.quantity || 1)));
      const unitPrice = Math.max(1, Math.round(Number(votePackage.price || 0)));
      const requestedVoteAmount =
        requestedVotes > 0
          ? calcRequestedVotesAmount(votePackage, requestedVotes)
          : null;
      amount = requestedVoteAmount?.amount || unitPrice * packageUnits;

      meta = {
        ...meta,
        paymentType: 'competition_vote',
        eventId: String(event._id),
        eventTitle: event.title,
        organizerId: event.organizerId ? String(event.organizerId) : '',
        organizerName: event.organizerName || '',
        contestantKey,
        contestantName: contestant.fullName,
        contestantCategory: contestant.category,
        packageId: String(votePackage._id || ''),
        packageName: String(votePackage.name || ''),
        packageUnits,
        votes:
          requestedVoteAmount?.votes ||
          Math.max(1, Number(votePackage.votes || 1)) * packageUnits,
        unitPrice: requestedVoteAmount?.unitPrice || unitPrice,
        commissionPercent: Number(
          event.commercialTerms?.votingCommissionPercent ??
            votingCommissionPercent
        ),
      };
    } else {
      const eventTitle = String(body.eventTitle || 'Event Ticket');
      const eventId = String(body.eventId || 'NIMBLYPOLLS');
      const tierName = normalizeTierName(body.tierName || 'regular');
      const quantity = Math.max(1, Math.round(Number(body.quantity || 1)));

      const event = await Event.findById(eventId);
      if (!event || event.status !== 'approved') {
        return NextResponse.json(
          { success: false, message: 'Event not available for checkout' },
          { status: 404 }
        );
      }

      const tier = event.tiers.find((item) => item.name === tierName);
      if (!tier) {
        return NextResponse.json(
          { success: false, message: 'Requested ticket tier does not exist' },
          { status: 400 }
        );
      }

      if (tier.isActive === false) {
        return NextResponse.json(
          {
            success: false,
            message: 'This ticket type is no longer available.',
          },
          { status: 409 }
        );
      }

      if (tier.remainingSlots < quantity) {
        return NextResponse.json(
          {
            success: false,
            message: `Only ${tier.remainingSlots} ${tierName.toUpperCase()} tickets remain`,
          },
          { status: 409 }
        );
      }

      const referralResult = await resolveTicketReferral(
        event._id,
        body.referrerId
      );
      if (!referralResult.valid) {
        return NextResponse.json(
          { success: false, message: 'Contestant ticket link is invalid.' },
          { status: 400 }
        );
      }

      amount = Math.round(Number(tier.price || 0) * quantity);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, message: 'Amount must be greater than 0' },
          { status: 400 }
        );
      }

      meta = {
        ...meta,
        paymentType: 'ticket',
        eventId: String(event._id),
        eventTitle: event.title,
        tierName,
        quantity,
        unitPrice: Number(tier.price || 0),
        commissionPercent: Number(
          event.commercialTerms?.ticketCommissionPercent ?? 20
        ),
        ...(referralResult.referral || {}),
      };
    }

    if (!hasMpesaConfig()) {
      const mockCheckoutRequestId = `CHECKOUT-${Date.now()}`;

      if (paymentType === 'vote') {
        const platformCommissionAmount = Math.round(
          amount * ((meta.commissionPercent ?? 20) / 100)
        );
        const organizerEarningsAmount = Math.max(
          0,
          amount - platformCommissionAmount
        );

        await VotingTransaction.create({
          campaignId: meta.campaignId,
          organizerId: meta.organizerId || null,
          contestantId: meta.contestantId,
          voterName: meta.customerEmail || '',
          voterEmail: meta.customerEmail || '',
          voterPhone: phone,
          packageName: meta.packageName,
          votes: meta.votes,
          unitPrice: meta.unitPrice,
          totalAmount: amount,
          commissionPercent: meta.commissionPercent,
          platformCommissionAmount,
          organizerEarningsAmount,
          status: 'paid',
          merchantRequestId: `MOCK-${Date.now()}`,
          checkoutRequestId: mockCheckoutRequestId,
          paidAt: new Date(),
          resultCode: 0,
          resultDesc: 'Mock payment completed',
        });
      } else if (paymentType === 'competition_vote') {
        const platformCommissionAmount = Math.round(
          amount * ((meta.commissionPercent ?? votingCommissionPercent) / 100)
        );
        const organizerEarningsAmount = Math.max(
          0,
          amount - platformCommissionAmount
        );

        const event = await Event.findById(meta.eventId);
        if (!event) {
          return NextResponse.json(
            { success: false, message: 'Competition event not found' },
            { status: 404 }
          );
        }

        await CompetitionVoteTransaction.create({
          eventId: event._id,
          organizerId: event.organizerId || null,
          contestantKey: meta.contestantKey,
          contestantName: meta.contestantName,
          contestantCategory: meta.contestantCategory,
          packageId: meta.packageId || '',
          packageName: meta.packageName || '',
          voterEmail: meta.customerEmail || '',
          voterPhone: phone,
          votes: meta.votes,
          unitPrice: meta.unitPrice,
          totalAmount: amount,
          commissionPercent: meta.commissionPercent ?? votingCommissionPercent,
          platformCommissionAmount,
          organizerEarningsAmount,
          status: 'paid',
          merchantRequestId: `MOCK-${Date.now()}`,
          checkoutRequestId: mockCheckoutRequestId,
          paidAt: new Date(),
          resultCode: 0,
          resultDesc: 'Mock payment completed',
        });

        const target = (event.competition?.contestants || []).find((item) => {
          const key = `${String(item?.fullName || '')
            .trim()
            .toLowerCase()}::${String(item?.category || '')
            .trim()
            .toLowerCase()}`;
          return key === meta.contestantKey;
        });
        if (target) {
          target.votes = Math.max(
            0,
            Number(target.votes || 0) + Number(meta.votes || 0)
          );
          event.markModified('competition.contestants');
          await event.save();
        }
      } else {
        const event = await Event.findById(meta.eventId);
        const tier = event.tiers.find((item) => item.name === meta.tierName);
        const commissionPercent = Number(meta.commissionPercent ?? 20);
        const platformCommissionAmount = Math.round(
          amount * (commissionPercent / 100)
        );

        // Generate ticket codes for mock
        let ticketCode = createTicketCode();
        let attempts = 0;
        while (attempts < 5) {
          const exists = await TicketOrder.findOne({ ticketCode });
          if (!exists) break;
          ticketCode = createTicketCode();
          attempts += 1;
        }
        const entryCode = createEntryCode();

        await TicketOrder.create({
          eventId: event._id,
          organizerId: event.organizerId,
          eventTitle: event.title,
          tierName: meta.tierName,
          quantity: meta.quantity,
          unitPrice: tier.price,
          totalAmount: amount,
          commissionPercent,
          platformCommissionAmount,
          organizerEarningsAmount: Math.max(
            0,
            amount - platformCommissionAmount
          ),
          customerPhone: phone,
          customerEmail: meta.customerEmail || '',
          referralCampaignId: meta.referralCampaignId || null,
          referralCompetitionEventId:
            meta.referralCompetitionEventId || null,
          referralContestantId: meta.referralContestantId || '',
          referralContestantName: meta.referralContestantName || '',
          referralContestantCategory:
            meta.referralContestantCategory || '',
          status: 'paid',
          merchantRequestId: `MOCK-${Date.now()}`,
          checkoutRequestId: mockCheckoutRequestId,
          paidAt: new Date(),
          resultCode: 0,
          resultDesc: 'Mock payment completed',
          ticketCode: ticketCode,
          entryCode: entryCode,
          entryStatus: 'pending',
        });

        tier.remainingSlots = Math.max(0, tier.remainingSlots - meta.quantity);
        await event.save();
      }

      initCheckoutStatus(mockCheckoutRequestId, {
        status: 'paid',
        mock: true,
        resultCode: 0,
        resultDesc: 'Mock payment completed (no Daraja credentials configured)',
        amount,
        phone,
        customerEmail: email,
        customerPhone: phone,
        ...meta,
      });

      return NextResponse.json({
        success: true,
        mock: true,
        merchantRequestId: `MOCK-${Date.now()}`,
        checkoutRequestId: mockCheckoutRequestId,
        customerMessage:
          'M-Pesa sandbox credentials are not set. Mock checkout created for development.',
      });
    }

    const { mode, baseUrl, transactionType, partyB } =
      resolveMpesaRuntimeConfig();

    const accessToken = await getAccessToken(baseUrl);
    const timestamp = getTimestamp();
    const businessShortCode = normalizeDigits(
      process.env.MPESA_SHORTCODE || partyB || ''
    );
    const resolvedPartyB = normalizeDigits(partyB || businessShortCode);

    if (!businessShortCode || !resolvedPartyB) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Invalid M-Pesa shortcode/till configuration. Confirm MPESA_SHORTCODE and MPESA_TILL_NUMBER.',
          details: {
            mode,
            transactionType,
            hasShortCode: Boolean(businessShortCode),
            hasPartyB: Boolean(resolvedPartyB),
          },
        },
        { status: 500 }
      );
    }

    const password = Buffer.from(
      `${businessShortCode}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const accountReference = sanitizeMpesaField(
      paymentType === 'vote'
        ? meta.campaignId || 'VOTE'
        : meta.eventId || 'TICKET',
      'NIMBLY',
      12
    );

    const transactionDesc = sanitizeMpesaField(
      paymentType === 'vote' || paymentType === 'competition_vote'
        ? `Vote ${meta.campaignTitle || meta.eventTitle || 'Competition'}`
        : `Ticket ${meta.eventTitle || 'Event'}`,
      'Payment',
      40
    );

    const stkPayload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: amount,
      PartyA: phone,
      PartyB: resolvedPartyB,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    let response;
    try {
      response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stkPayload),
        cache: 'no-store',
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Unable to reach M-Pesa STK endpoint: ${error.message}`,
        },
        { status: 502 }
      );
    }

    const data = await readResponseBody(response);

    if (!response.ok || data?.errorCode) {
      const safeDebug = {
        mode,
        paymentType,
        transactionType,
        baseUrl,
        upstreamStatus: response.status,
        payloadShape: {
          BusinessShortCode: stkPayload.BusinessShortCode,
          PartyA: stkPayload.PartyA,
          PartyB: stkPayload.PartyB,
          Amount: stkPayload.Amount,
          AccountReference: stkPayload.AccountReference,
          TransactionDesc: stkPayload.TransactionDesc,
        },
      };

      console.error('MPESA STK upstream failure', {
        ...safeDebug,
        upstream: data,
      });

      return NextResponse.json(
        {
          success: false,
          message:
            data?.errorMessage ||
            data?.ResponseDescription ||
            'M-Pesa request failed',
          details: data,
          debug: safeDebug,
        },
        { status: 502 }
      );
    }

    const checkoutRequestId = data?.CheckoutRequestID;
    const merchantRequestId = data?.MerchantRequestID;

    if (!checkoutRequestId || !merchantRequestId) {
      return NextResponse.json(
        {
          success: false,
          message: 'M-Pesa response did not include a checkout request id',
          details: data,
        },
        { status: 502 }
      );
    }

    initCheckoutStatus(checkoutRequestId, {
      status: 'pending',
      mock: false,
      resultCode: Number(data?.ResponseCode ?? 0),
      resultDesc: data?.ResponseDescription || 'Request accepted by M-Pesa',
      merchantRequestId,
      amount,
      phone,
      customerEmail: email,
      customerPhone: phone,
      ...meta,
    });

    setCheckoutStatus(checkoutRequestId, {
      customerMessage:
        data?.CustomerMessage || 'M-Pesa prompt sent to your phone.',
      customerEmail: email,
      customerPhone: phone,
    });

    if (paymentType === 'vote') {
      const platformCommissionAmount = Math.round(
        amount * ((meta.commissionPercent ?? 20) / 100)
      );
      const organizerEarningsAmount = Math.max(
        0,
        amount - platformCommissionAmount
      );

      await VotingTransaction.create({
        campaignId: meta.campaignId,
        organizerId: meta.organizerId || null,
        contestantId: meta.contestantId,
        voterName: meta.customerEmail || '',
        voterEmail: meta.customerEmail || '',
        voterPhone: phone,
        packageName: meta.packageName,
        votes: meta.votes,
        unitPrice: meta.unitPrice,
        totalAmount: amount,
        commissionPercent: meta.commissionPercent,
        platformCommissionAmount,
        organizerEarningsAmount,
        status: 'pending',
        merchantRequestId,
        checkoutRequestId,
        resultCode: Number(data.ResponseCode ?? 0),
        resultDesc: data.ResponseDescription || 'Checkout request accepted',
      });
    } else if (paymentType === 'competition_vote') {
      const platformCommissionAmount = Math.round(
        amount * ((meta.commissionPercent ?? votingCommissionPercent) / 100)
      );
      const organizerEarningsAmount = Math.max(
        0,
        amount - platformCommissionAmount
      );

      const event = await Event.findById(meta.eventId);
      if (!event) {
        return NextResponse.json(
          { success: false, message: 'Competition event not found' },
          { status: 404 }
        );
      }

      await CompetitionVoteTransaction.create({
        eventId: event._id,
        organizerId: event.organizerId || null,
        contestantKey: meta.contestantKey,
        contestantName: meta.contestantName,
        contestantCategory: meta.contestantCategory,
        packageId: meta.packageId || '',
        packageName: meta.packageName || '',
        voterEmail: meta.customerEmail || '',
        voterPhone: phone,
        votes: meta.votes,
        unitPrice: meta.unitPrice,
        totalAmount: amount,
        commissionPercent: meta.commissionPercent ?? votingCommissionPercent,
        platformCommissionAmount,
        organizerEarningsAmount,
        status: 'pending',
        merchantRequestId,
        checkoutRequestId,
        resultCode: Number(data.ResponseCode ?? 0),
        resultDesc: data.ResponseDescription || 'Checkout request accepted',
      });
    } else {
      const event = await Event.findById(meta.eventId);
      const tier = event.tiers.find((item) => item.name === meta.tierName);
      const commissionPercent = Number(meta.commissionPercent ?? 20);
      const platformCommissionAmount = Math.round(
        amount * (commissionPercent / 100)
      );

      // Generate ticket code and entry code BEFORE creating the order
      let ticketCode = createTicketCode();
      let attempts = 0;
      while (attempts < 5) {
        const exists = await TicketOrder.findOne({ ticketCode });
        if (!exists) break;
        ticketCode = createTicketCode();
        attempts += 1;
      }
      const entryCode = createEntryCode();

      await TicketOrder.create({
        eventId: event._id,
        organizerId: event.organizerId,
        eventTitle: event.title,
        tierName: meta.tierName,
        quantity: meta.quantity,
        unitPrice: tier.price,
        totalAmount: amount,
        commissionPercent,
        platformCommissionAmount,
        organizerEarningsAmount: Math.max(0, amount - platformCommissionAmount),
        customerPhone: phone,
        customerEmail: meta.customerEmail || '',
        referralCampaignId: meta.referralCampaignId || null,
        referralCompetitionEventId:
          meta.referralCompetitionEventId || null,
        referralContestantId: meta.referralContestantId || '',
        referralContestantName: meta.referralContestantName || '',
        referralContestantCategory:
          meta.referralContestantCategory || '',
        status: 'pending',
        merchantRequestId,
        checkoutRequestId,
        resultCode: Number(data.ResponseCode ?? 0),
        resultDesc: data.ResponseDescription || 'Checkout request accepted',
        ticketCode: ticketCode,
        entryCode: entryCode,
        entryStatus: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      mock: false,
      merchantRequestId,
      checkoutRequestId,
      responseCode: data?.ResponseCode,
      customerMessage:
        data?.CustomerMessage || 'M-Pesa prompt sent to your phone.',
    });
  } catch (error) {
    console.error('MPESA checkout error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to initiate M-Pesa checkout',
      },
      { status: 500 }
    );
  }
}
