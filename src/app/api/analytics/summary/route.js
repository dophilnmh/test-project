import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import TicketOrder from '@/app/models/TicketOrder';
import MerchOrder from '@/app/models/MerchOrder';
import Organizer from '@/app/models/Organizer';
import Event from '@/app/models/Event';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import VotingCampaign from '@/app/models/VotingCampaign';
import { auth } from '@/app/auth';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePlatformCommission(row) {
  const explicit = toNumber(row?.platformCommissionAmount, Number.NaN);
  if (!Number.isNaN(explicit)) {
    return Math.max(0, explicit);
  }

  const amount = Math.max(0, toNumber(row?.totalAmount, 0));
  const percent = Math.min(
    100,
    Math.max(0, toNumber(row?.commissionPercent, 20))
  );
  return Math.round(amount * (percent / 100));
}

function parseDateParam(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inDateRange(value, from, to) {
  if (!from && !to) return true;
  const dt = parseDateParam(value);
  if (!dt) return false;
  const time = dt.getTime();
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}

function getTxnDate(row) {
  return row?.paidAt || row?.createdAt || null;
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    await connect();

    const fromParam = parseDateParam(req?.nextUrl?.searchParams?.get('from'));
    const toParam = parseDateParam(req?.nextUrl?.searchParams?.get('to'));
    const from = fromParam;
    const to = toParam;

    const role = session.user.role;

    if (role === 'admin' || role === 'superadmin') {
      const [paidOrders, merchOrders, paidVotingTx, paidCompetitionVotingTx] =
        await Promise.all([
          TicketOrder.find({ status: 'paid' }).lean(),
          MerchOrder.find({ status: { $ne: 'cancelled' } }).lean(),
          VotingTransaction.find({ status: 'paid' }).lean(),
          CompetitionVoteTransaction.find({ status: 'paid' }).lean(),
        ]);

      const rangedPaidOrders = paidOrders.filter((row) =>
        inDateRange(getTxnDate(row), from, to)
      );
      const rangedMerchOrders = merchOrders.filter((row) =>
        inDateRange(getTxnDate(row), from, to)
      );
      const rangedPaidVotingTx = paidVotingTx.filter((row) =>
        inDateRange(getTxnDate(row), from, to)
      );
      const rangedPaidCompetitionVotingTx = paidCompetitionVotingTx.filter(
        (row) => inDateRange(getTxnDate(row), from, to)
      );

      const totalFunds = rangedPaidOrders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0
      );
      const totalTickets = rangedPaidOrders.reduce(
        (sum, order) => sum + Number(order.quantity || 0),
        0
      );
      const totalEvents = await Event.countDocuments({ status: 'approved' });

      const merchPlatformEarnings = rangedMerchOrders.reduce(
        (sum, order) => sum + resolvePlatformCommission(order),
        0
      );
      const votingCampaignPlatformEarnings = rangedPaidVotingTx.reduce(
        (sum, tx) => sum + resolvePlatformCommission(tx),
        0
      );
      const votingCompetitionPlatformEarnings =
        rangedPaidCompetitionVotingTx.reduce(
          (sum, tx) => sum + resolvePlatformCommission(tx),
          0
        );
      const votingPlatformEarnings =
        votingCampaignPlatformEarnings + votingCompetitionPlatformEarnings;
      const totalPlatformEarnings =
        merchPlatformEarnings + votingPlatformEarnings;

      const campaignIds = rangedPaidVotingTx
        .map((transaction) => transaction?.campaignId)
        .filter(Boolean);
      const campaigns = campaignIds.length
        ? await VotingCampaign.find({ _id: { $in: campaignIds } })
            .select('title organizerName')
            .lean()
        : [];
      const campaignById = new Map(
        campaigns.map((campaign) => [String(campaign._id), campaign])
      );
      const eventIds = rangedPaidCompetitionVotingTx
        .map((transaction) => transaction?.eventId)
        .filter(Boolean);
      const votingEvents = eventIds.length
        ? await Event.find({ _id: { $in: eventIds } })
            .select('title organizerName')
            .lean()
        : [];
      const eventById = new Map(
        votingEvents.map((event) => [String(event._id), event])
      );
      const votingRows = new Map();

      const addVotingTransaction = (transaction, type, source) => {
        const key = `${type}:${String(source?._id || '')}`;
        const current = votingRows.get(key) || {
          id: String(source?._id || ''),
          type,
          title: String(source?.title || 'Untitled voting event'),
          organizerName: String(source?.organizerName || ''),
          totalVoteFunds: 0,
          platformCommission: 0,
          organizerEarnings: 0,
          votes: 0,
        };
        const amount = Math.max(0, toNumber(transaction?.totalAmount, 0));
        const commission = resolvePlatformCommission(transaction);
        const earnings = Math.max(
          0,
          toNumber(transaction?.organizerEarningsAmount, amount - commission)
        );
        current.totalVoteFunds += amount;
        current.platformCommission += commission;
        current.organizerEarnings += earnings;
        current.votes += Math.max(0, toNumber(transaction?.votes, 0));
        votingRows.set(key, current);
      };

      rangedPaidVotingTx.forEach((transaction) => {
        const campaign = campaignById.get(String(transaction?.campaignId));
        addVotingTransaction(
          transaction,
          'campaign',
          campaign || {
            _id: transaction?.campaignId,
            title: 'Archived voting campaign',
          }
        );
      });
      rangedPaidCompetitionVotingTx.forEach((transaction) => {
        const event = eventById.get(String(transaction?.eventId));
        addVotingTransaction(
          transaction,
          'competition',
          event || {
            _id: transaction?.eventId,
            title: 'Archived competition event',
          }
        );
      });
      const votingProceedsByEvent = Array.from(votingRows.values()).sort(
        (a, b) => b.totalVoteFunds - a.totalVoteFunds
      );

      const sourceBreakdown = [
        { source: 'merchandise', amount: merchPlatformEarnings },
        {
          source: 'voting_campaigns',
          amount: votingCampaignPlatformEarnings,
        },
        {
          source: 'voting_competitions',
          amount: votingCompetitionPlatformEarnings,
        },
        { source: 'voting_total', amount: votingPlatformEarnings },
        { source: 'platform_total', amount: totalPlatformEarnings },
      ];

      return NextResponse.json({
        success: true,
        scope: 'admin',
        range: {
          from: from ? from.toISOString() : null,
          to: to ? to.toISOString() : null,
        },
        summary: {
          totalFunds,
          totalTickets,
          totalOrders: rangedPaidOrders.length,
          totalEvents,
          merchPlatformEarnings,
          votingPlatformEarnings,
          totalPlatformEarnings,
          votingCampaignPlatformEarnings,
          votingCompetitionPlatformEarnings,
          votingProceedsByEvent,
          sourceBreakdown,
        },
      });
    }

    const organizer = await Organizer.findOne({
      email: session.user.email,
    }).lean();
    if (!organizer) {
      return NextResponse.json({
        success: true,
        scope: 'organizer',
        summary: {
          totalFunds: 0,
          totalTickets: 0,
          totalOrders: 0,
          totalEvents: 0,
          merchPlatformEarnings: 0,
          votingPlatformEarnings: 0,
          totalPlatformEarnings: 0,
          votingCampaignPlatformEarnings: 0,
          votingCompetitionPlatformEarnings: 0,
          sourceBreakdown: [],
        },
      });
    }

    const paidOrders = await TicketOrder.find({
      organizerId: organizer._id,
      status: 'paid',
    }).lean();

    const totalFunds = paidOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );
    const totalTickets = paidOrders.reduce(
      (sum, order) => sum + Number(order.quantity || 0),
      0
    );
    const totalEvents = await Event.countDocuments({
      organizerId: organizer._id,
    });

    return NextResponse.json({
      success: true,
      scope: 'organizer',
      summary: {
        totalFunds,
        totalTickets,
        totalOrders: paidOrders.length,
        totalEvents,
        merchPlatformEarnings: 0,
        votingPlatformEarnings: 0,
        totalPlatformEarnings: 0,
        votingCampaignPlatformEarnings: 0,
        votingCompetitionPlatformEarnings: 0,
        sourceBreakdown: [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load analytics summary',
      },
      { status: 500 }
    );
  }
}
