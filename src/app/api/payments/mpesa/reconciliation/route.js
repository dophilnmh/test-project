import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';
import TicketOrder from '@/app/models/TicketOrder';
import Event from '@/app/models/Event';
import VotingCampaign from '@/app/models/VotingCampaign';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';

const ALLOWED_STATUSES = new Set(['pending', 'paid', 'failed']);
const ALLOWED_TYPES = new Set(['ticket', 'campaign_vote', 'competition_vote']);

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toQueryOptions(searchParams) {
  const status = String(searchParams.get('status') || '')
    .trim()
    .toLowerCase();
  const type = String(searchParams.get('type') || '')
    .trim()
    .toLowerCase();
  const q = String(searchParams.get('q') || '').trim();
  const limitRaw = Number(searchParams.get('limit') || 100);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(300, Math.trunc(limitRaw)))
    : 100;

  return {
    status: ALLOWED_STATUSES.has(status) ? status : '',
    type: ALLOWED_TYPES.has(type) ? type : '',
    q,
    limit,
  };
}

function buildSearchFilter(q, fields) {
  if (!q) return null;

  const safe = escapeRegex(q);
  const regex = new RegExp(safe, 'i');

  return {
    $or: fields.map((field) => ({ [field]: regex })),
  };
}

function mapTicket(item) {
  return {
    id: String(item._id || ''),
    type: 'ticket',
    status: String(item.status || ''),
    title: String(item.eventTitle || 'Ticket purchase'),
    amount: Number(item.totalAmount || 0),
    quantity: Number(item.quantity || 0),
    votes: 0,
    phone: String(item.customerPhone || ''),
    email: String(item.customerEmail || ''),
    mpesaReceiptNumber: String(item.mpesaReceiptNumber || ''),
    checkoutRequestId: String(item.checkoutRequestId || ''),
    merchantRequestId: String(item.merchantRequestId || ''),
    resultCode: item.resultCode ?? null,
    resultDesc: String(item.resultDesc || ''),
    recoveredBy: String(item.recoveredBy || ''),
    recoveredAt: item.recoveredAt || null,
    recoveryNote: String(item.recoveryNote || ''),
    paidAt: item.paidAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function mapCampaignVote(item) {
  return {
    id: String(item._id || ''),
    type: 'campaign_vote',
    status: String(item.status || ''),
    title: String(item.campaignTitle || 'Campaign vote'),
    amount: Number(item.totalAmount || 0),
    quantity: 0,
    votes: Number(item.votes || 0),
    phone: String(item.voterPhone || ''),
    email: String(item.voterEmail || ''),
    mpesaReceiptNumber: String(item.mpesaReceiptNumber || ''),
    checkoutRequestId: String(item.checkoutRequestId || ''),
    merchantRequestId: String(item.merchantRequestId || ''),
    resultCode: item.resultCode ?? null,
    resultDesc: String(item.resultDesc || ''),
    recoveredBy: String(item.recoveredBy || ''),
    recoveredAt: item.recoveredAt || null,
    recoveryNote: String(item.recoveryNote || ''),
    paidAt: item.paidAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function mapCompetitionVote(item) {
  return {
    id: String(item._id || ''),
    type: 'competition_vote',
    status: String(item.status || ''),
    title: String(item.eventTitle || 'Competition vote'),
    amount: Number(item.totalAmount || 0),
    quantity: 0,
    votes: Number(item.votes || 0),
    phone: String(item.voterPhone || ''),
    email: String(item.voterEmail || ''),
    mpesaReceiptNumber: String(item.mpesaReceiptNumber || ''),
    checkoutRequestId: String(item.checkoutRequestId || ''),
    merchantRequestId: String(item.merchantRequestId || ''),
    resultCode: item.resultCode ?? null,
    resultDesc: String(item.resultDesc || ''),
    recoveredBy: String(item.recoveredBy || ''),
    recoveredAt: item.recoveredAt || null,
    recoveryNote: String(item.recoveryNote || ''),
    paidAt: item.paidAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function buildSummary(items) {
  return items.reduce(
    (acc, item) => {
      const amount = Number(item.amount || 0);
      if (item.status === 'paid') {
        acc.paid += 1;
        acc.paidAmount += amount;
      } else if (item.status === 'failed') {
        acc.failed += 1;
        acc.failedAmount += amount;
      } else {
        acc.pending += 1;
        acc.pendingAmount += amount;
      }
      acc.total += 1;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      failed: 0,
      paid: 0,
      pendingAmount: 0,
      failedAmount: 0,
      paidAmount: 0,
    }
  );
}

function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

async function markTicketRecovered(order, { receiptNumber, reviewer, note }) {
  const transitioningToPaid = order.status !== 'paid';

  order.status = 'paid';
  order.resultCode = 0;
  order.resultDesc = `Manually recovered by ${reviewer}`;
  if (receiptNumber) {
    order.mpesaReceiptNumber = receiptNumber;
  }
  if (!order.paidAt) {
    order.paidAt = new Date();
  }
  order.recoveredBy = reviewer;
  order.recoveredAt = new Date();
  order.recoveryNote = note;
  await order.save();

  if (!transitioningToPaid) {
    return;
  }

  const event = await Event.findById(order.eventId);
  if (!event) {
    return;
  }

  const tier = (event.tiers || []).find(
    (item) => String(item?.name || '') === String(order.tierName || '')
  );

  if (!tier) {
    return;
  }

  tier.remainingSlots = Math.max(
    0,
    Number(tier.remainingSlots || 0) - Number(order.quantity || 0)
  );
  await event.save();
}

async function markCampaignVoteRecovered(
  transaction,
  { receiptNumber, reviewer, note }
) {
  const transitioningToPaid = transaction.status !== 'paid';

  transaction.status = 'paid';
  transaction.resultCode = 0;
  transaction.resultDesc = `Manually recovered by ${reviewer}`;
  if (receiptNumber) {
    transaction.mpesaReceiptNumber = receiptNumber;
  }
  if (!transaction.paidAt) {
    transaction.paidAt = new Date();
  }
  transaction.recoveredBy = reviewer;
  transaction.recoveredAt = new Date();
  transaction.recoveryNote = note;
  await transaction.save();

  if (!transitioningToPaid) {
    return;
  }

  const campaign = await VotingCampaign.findById(transaction.campaignId);
  if (!campaign) {
    return;
  }

  const contestant = (campaign.contestants || campaign.nominees || []).find(
    (item) => String(item?._id || '') === String(transaction.contestantId || '')
  );

  if (contestant) {
    contestant.voteCount = Math.max(
      0,
      Number(contestant.voteCount || 0) + Number(transaction.votes || 0)
    );
  }

  campaign.totalVotes = Math.max(
    0,
    Number(campaign.totalVotes || 0) + Number(transaction.votes || 0)
  );
  campaign.nominees = campaign.contestants || campaign.nominees;
  await campaign.save();
}

async function markCompetitionVoteRecovered(
  transaction,
  { receiptNumber, reviewer, note }
) {
  const transitioningToPaid = transaction.status !== 'paid';

  transaction.status = 'paid';
  transaction.resultCode = 0;
  transaction.resultDesc = `Manually recovered by ${reviewer}`;
  if (receiptNumber) {
    transaction.mpesaReceiptNumber = receiptNumber;
  }
  if (!transaction.paidAt) {
    transaction.paidAt = new Date();
  }
  transaction.recoveredBy = reviewer;
  transaction.recoveredAt = new Date();
  transaction.recoveryNote = note;
  await transaction.save();

  if (!transitioningToPaid) {
    return;
  }

  const event = await Event.findById(transaction.eventId);
  if (!event || event.eventType !== 'competition') {
    return;
  }

  const target = (event.competition?.contestants || []).find((item) => {
    const key = `${String(item?.fullName || '')
      .trim()
      .toLowerCase()}::${String(item?.category || '')
      .trim()
      .toLowerCase()}`;
    return key === String(transaction.contestantKey || '');
  });

  if (!target) {
    return;
  }

  target.votes = Math.max(
    0,
    Number(target.votes || 0) + Number(transaction.votes || 0)
  );
  event.markModified('competition.contestants');
  await event.save();
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = String(session.user.role || '').toLowerCase();
    const isAdmin = isAdminRole(role);
    const isOrganizer = role === 'organizer';

    if (!isAdmin && !isOrganizer) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      );
    }

    await connect();

    let organizerFilter = {};
    if (!isAdmin) {
      const organizer = await Organizer.findOne({
        email: String(session.user.email || '')
          .trim()
          .toLowerCase(),
      })
        .select('_id')
        .lean();

      if (!organizer?._id) {
        return NextResponse.json({
          success: true,
          items: [],
          summary: buildSummary([]),
          message: 'Organizer account not found for this user',
        });
      }

      organizerFilter = { organizerId: organizer._id };
    }

    const { searchParams } = new URL(req.url);
    const options = toQueryOptions(searchParams);

    const baseFilter = {
      ...(options.status ? { status: options.status } : {}),
      ...organizerFilter,
    };

    const ticketFilter = {
      ...baseFilter,
      ...(buildSearchFilter(options.q, [
        'eventTitle',
        'customerPhone',
        'customerEmail',
        'mpesaReceiptNumber',
        'checkoutRequestId',
        'merchantRequestId',
      ]) || {}),
    };

    const campaignVoteFilter = {
      ...baseFilter,
      ...(buildSearchFilter(options.q, [
        'campaignTitle',
        'voterPhone',
        'voterEmail',
        'mpesaReceiptNumber',
        'checkoutRequestId',
        'merchantRequestId',
      ]) || {}),
    };

    const competitionVoteFilter = {
      ...baseFilter,
      ...(buildSearchFilter(options.q, [
        'eventTitle',
        'contestantName',
        'voterPhone',
        'voterEmail',
        'mpesaReceiptNumber',
        'checkoutRequestId',
        'merchantRequestId',
      ]) || {}),
    };

    const fetchLimit = options.limit;

    const [ticketOrders, campaignVotes, competitionVotes] = await Promise.all([
      options.type && options.type !== 'ticket'
        ? Promise.resolve([])
        : TicketOrder.find(ticketFilter)
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .lean(),
      options.type && options.type !== 'campaign_vote'
        ? Promise.resolve([])
        : VotingTransaction.find(campaignVoteFilter)
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .lean(),
      options.type && options.type !== 'competition_vote'
        ? Promise.resolve([])
        : CompetitionVoteTransaction.find(competitionVoteFilter)
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .lean(),
    ]);

    const items = [
      ...ticketOrders.map(mapTicket),
      ...campaignVotes.map(mapCampaignVote),
      ...competitionVotes.map(mapCompetitionVote),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, fetchLimit);

    return NextResponse.json({
      success: true,
      items,
      summary: buildSummary(items),
      canRecover: isAdmin,
      filters: {
        status: options.status,
        type: options.type,
        q: options.q,
        limit: options.limit,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load reconciliation records',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = String(session.user.role || '').toLowerCase();
    if (!isAdminRole(role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const type = String(body?.type || '')
      .trim()
      .toLowerCase();
    const id = String(body?.id || '').trim();
    const receiptNumber = String(body?.mpesaReceiptNumber || '')
      .trim()
      .toUpperCase();
    const recoveryNote = String(body?.recoveryNote || '')
      .trim()
      .slice(0, 500);

    if (!ALLOWED_TYPES.has(type) || !id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid transaction type and id are required',
        },
        { status: 400 }
      );
    }

    await connect();

    const reviewer = String(session.user.email || '')
      .trim()
      .toLowerCase();

    if (type === 'ticket') {
      const order = await TicketOrder.findById(id);
      if (!order) {
        return NextResponse.json(
          { success: false, message: 'Ticket transaction not found' },
          { status: 404 }
        );
      }

      await markTicketRecovered(order, {
        receiptNumber,
        reviewer,
        note: recoveryNote,
      });
      return NextResponse.json({
        success: true,
        message: 'Ticket payment marked as paid and reconciled',
        item: mapTicket(order.toObject()),
      });
    }

    if (type === 'campaign_vote') {
      const transaction = await VotingTransaction.findById(id);
      if (!transaction) {
        return NextResponse.json(
          { success: false, message: 'Campaign vote transaction not found' },
          { status: 404 }
        );
      }

      await markCampaignVoteRecovered(transaction, {
        receiptNumber,
        reviewer,
        note: recoveryNote,
      });
      return NextResponse.json({
        success: true,
        message: 'Campaign vote marked as paid and reconciled',
        item: mapCampaignVote(transaction.toObject()),
      });
    }

    const transaction = await CompetitionVoteTransaction.findById(id);
    if (!transaction) {
      return NextResponse.json(
        { success: false, message: 'Competition vote transaction not found' },
        { status: 404 }
      );
    }

    await markCompetitionVoteRecovered(transaction, {
      receiptNumber,
      reviewer,
      note: recoveryNote,
    });
    return NextResponse.json({
      success: true,
      message: 'Competition vote marked as paid and reconciled',
      item: mapCompetitionVote(transaction.toObject()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to recover transaction',
      },
      { status: 500 }
    );
  }
}
