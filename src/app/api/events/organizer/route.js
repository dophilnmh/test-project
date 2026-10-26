import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import Organizer from '@/app/models/Organizer';
import TicketOrder from '@/app/models/TicketOrder';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import FundRequest from '@/app/models/FundRequest';
import MerchProduct from '@/app/models/MerchProduct';
import MerchOrder from '@/app/models/MerchOrder';
import { auth } from '@/app/auth';

function toObjectIdList(items) {
  return items.map((item) => item?._id).filter(Boolean);
}

function toEventWindow(event) {
  const start = new Date(event?.startDateTime || event?.date || 0);
  if (Number.isNaN(start.getTime())) return { start: null, end: null };

  let end = event?.endDateTime ? new Date(event.endDateTime) : null;
  if (!end || Number.isNaN(end.getTime()) || end < start) {
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function isRunningApprovedEvent(event, nowMs) {
  if (String(event?.status || '').toLowerCase() !== 'approved') return false;
  const { start, end } = toEventWindow(event);
  if (!start || !end) return false;
  return nowMs >= start.getTime() && nowMs <= end.getTime();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapContestantStatus(event) {
  const contestants = event?.competition?.contestants || [];
  const ranked = [...contestants]
    .map((item) => ({
      fullName: String(item?.fullName || '').trim(),
      category: String(item?.category || '').trim(),
      votes: Math.max(0, toNumber(item?.votes || 0)),
      profileImageUrl: String(item?.profileImageUrl || '').trim(),
    }))
    .filter((item) => item.fullName)
    .sort((a, b) => b.votes - a.votes);

  if (ranked.length === 0) return [];
  const topVotes = ranked[0].votes;

  return ranked.map((row, index) => {
    let status = 'behind';
    if (row.votes <= 0) status = 'no_votes';
    else if (row.votes === topVotes && index === 0) status = 'leading';
    else if (row.votes === topVotes) status = 'tied';
    else if (index === 1) status = 'runner_up';

    return {
      ...row,
      rank: index + 1,
      status,
    };
  });
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

    const organizer = await Organizer.findOne({
      email: session.user.email,
    }).lean();
    if (!organizer) {
      return NextResponse.json({
        success: true,
        events: [],
        stats: null,
        organizer: null,
      });
    }

    const scope = String(req?.nextUrl?.searchParams?.get('scope') || '')
      .trim()
      .toLowerCase();
    const selectedEventId = String(
      req?.nextUrl?.searchParams?.get('eventId') || ''
    ).trim();
    const selectedMerchProductId = selectedEventId.startsWith('merch:')
      ? selectedEventId.slice('merch:'.length)
      : '';
    const now = Date.now();

    const allEvents = await Event.find({ organizerId: organizer._id })
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(15000);

    const approvedEvents = allEvents.filter(
      (item) => String(item?.status || '').toLowerCase() === 'approved'
    );
    const runningApprovedEvents = approvedEvents.filter((item) =>
      isRunningApprovedEvent(item, now)
    );

    const scopedEvents =
      scope === 'dashboard'
        ? runningApprovedEvents
        : scope === 'analytics'
          ? approvedEvents
          : allEvents;

    const eventOptions = scopedEvents.map((event) => ({
      eventId: String(event?._id || ''),
      title: String(event?.title || 'Untitled event'),
      eventType: String(event?.eventType || 'ticketing'),
      status: String(event?.status || ''),
      startDateTime: event?.startDateTime || null,
      endDateTime: event?.endDateTime || null,
    }));

    const merchProducts =
      scope === 'analytics'
        ? await MerchProduct.find({
            organizerId: organizer._id,
            approvalStatus: 'approved',
          })
            .select('_id name eventId')
            .sort({ createdAt: -1 })
            .lean()
        : [];
    const merchProductOptions = merchProducts.map((product) => ({
      eventId: `merch:${String(product._id)}`,
      title: `Merchandise shop: ${product.name}`,
      eventType: 'merchandise',
      sourceType: 'merchandise',
      status: 'approved',
      productId: String(product._id),
    }));
    const availableEvents = [...eventOptions, ...merchProductOptions];
    const hasSelectedEvent = Boolean(selectedEventId);
    const scopedToSelectedEvents = hasSelectedEvent && !selectedMerchProductId
      ? scopedEvents.filter(
          (event) => String(event?._id || '') === selectedEventId
        )
      : selectedMerchProductId
        ? []
        : scopedEvents;

    const activeEvent = hasSelectedEvent
      ? availableEvents.find((event) => event.eventId === selectedEventId) ||
        null
      : availableEvents[0] || null;

    const scopedEventIds = toObjectIdList(scopedToSelectedEvents);
    const useScopedEventFilter = scope === 'dashboard' || scope === 'analytics';
    const selectedMerchProduct = selectedMerchProductId
      ? merchProducts.find(
          (product) => String(product._id) === selectedMerchProductId
        )
      : null;

    const ticketFilter = {
      organizerId: organizer._id,
      status: 'paid',
      ...(useScopedEventFilter ? { eventId: { $in: scopedEventIds } } : {}),
    };

    const competitionFilter = {
      organizerId: organizer._id,
      status: 'paid',
      ...(useScopedEventFilter ? { eventId: { $in: scopedEventIds } } : {}),
    };

    const [
      paidOrders,
      referralOrders,
      paidCompetitionTransactions,
      fundRequests,
      paidMerchOrders,
    ] = await Promise.all([
      useScopedEventFilter && scopedEventIds.length === 0
        ? []
        : TicketOrder.find(ticketFilter).lean().maxTimeMS(15000),
      useScopedEventFilter && scopedEventIds.length === 0
        ? []
        : TicketOrder.find({
            organizerId: organizer._id,
            status: 'paid',
            ...(useScopedEventFilter
              ? {
                  $or: [
                    { eventId: { $in: scopedEventIds } },
                    { referralCompetitionEventId: { $in: scopedEventIds } },
                  ],
                }
              : {}),
          })
            .lean()
            .maxTimeMS(15000),
      useScopedEventFilter && scopedEventIds.length === 0
        ? []
        : CompetitionVoteTransaction.find(competitionFilter)
            .lean()
            .maxTimeMS(15000),
      FundRequest.find({ organizerId: organizer._id })
        .select('amount status')
        .lean()
        .maxTimeMS(15000),
      useScopedEventFilter && selectedMerchProduct
        ? MerchOrder.find({
            organizerId: organizer._id,
            productId: selectedMerchProduct._id,
            paymentStatus: 'paid',
          })
            .lean()
            .maxTimeMS(15000)
        : [],
    ]);

    const collectedFunds = paidOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );

    const soldTickets = paidOrders.reduce(
      (sum, order) => sum + Number(order.quantity || 0),
      0
    );

    const referralSalesMap = new Map();
    for (const order of referralOrders) {
      const contestantId = String(order.referralContestantId || '').trim();
      if (!contestantId) continue;
      const eventId = String(order.eventId || '');
      const sourceCompetitionEventId = String(
        order.referralCompetitionEventId || ''
      );
      const tierName = String(order.tierName || 'Ticket').trim() || 'Ticket';
      const key = `${eventId}::${sourceCompetitionEventId}::${contestantId}::${tierName}`;
      const current = referralSalesMap.get(key) || {
        eventId,
        ticketEventTitle: String(order.eventTitle || '').trim(),
        sourceCompetitionEventId,
        contestantId,
        contestantName: String(order.referralContestantName || '').trim(),
        contestantCategory: String(
          order.referralContestantCategory || ''
        ).trim(),
        tierName,
        tickets: 0,
        orders: 0,
        revenue: 0,
      };
      current.tickets += Math.max(0, toNumber(order.quantity || 0));
      current.orders += 1;
      current.revenue += Math.max(0, toNumber(order.totalAmount || 0));
      referralSalesMap.set(key, current);
    }
    const ticketSalesByContestant = Array.from(referralSalesMap.values()).sort(
      (a, b) =>
        a.contestantName.localeCompare(b.contestantName) ||
        a.tierName.localeCompare(b.tierName)
    );

    const competitionRevenue = paidCompetitionTransactions.reduce(
      (sum, item) => sum + toNumber(item.totalAmount || 0),
      0
    );

    const competitionVotes = paidCompetitionTransactions.reduce(
      (sum, item) => sum + toNumber(item.votes || 0),
      0
    );

    const ticketPlatformCommission = paidOrders.reduce((sum, order) => {
      const amount = Math.max(0, toNumber(order.totalAmount || 0));
      const commissionPercent = Math.min(
        100,
        Math.max(0, toNumber(order.commissionPercent, 20))
      );
      const commissionFromRate = Math.round(amount * (commissionPercent / 100));
      const explicit = toNumber(order.platformCommissionAmount, Number.NaN);
      const commission =
        Number.isNaN(explicit) || (explicit === 0 && commissionFromRate > 0)
          ? commissionFromRate
          : explicit;
      return sum + commission;
    }, 0);

    const ticketOrganizerEarnings = paidOrders.reduce((sum, order) => {
      const amount = Math.max(0, toNumber(order.totalAmount || 0));
      const commissionPercent = Math.min(
        100,
        Math.max(0, toNumber(order.commissionPercent, 20))
      );
      const commissionFromRate = Math.round(amount * (commissionPercent / 100));
      const fallback = Math.max(0, amount - commissionFromRate);
      const explicit = toNumber(order.organizerEarningsAmount, Number.NaN);
      const earnings =
        Number.isNaN(explicit) ||
        (explicit === 0 && fallback > 0 && commissionPercent < 100)
          ? fallback
          : explicit;
      return sum + earnings;
    }, 0);

    const competitionPlatformCommission = paidCompetitionTransactions.reduce(
      (sum, item) => {
        const amount = Math.max(0, toNumber(item.totalAmount || 0));
        const commissionPercent = Math.min(
          100,
          Math.max(0, toNumber(item.commissionPercent, 20))
        );
        const commissionFromRate = Math.round(
          amount * (commissionPercent / 100)
        );
        const explicit = toNumber(item.platformCommissionAmount, Number.NaN);
        const commission =
          Number.isNaN(explicit) || (explicit === 0 && commissionFromRate > 0)
            ? commissionFromRate
            : explicit;
        return sum + commission;
      },
      0
    );

    const competitionOrganizerEarnings = paidCompetitionTransactions.reduce(
      (sum, item) => {
        const explicit = toNumber(item.organizerEarningsAmount, Number.NaN);
        const amount = Math.max(0, toNumber(item.totalAmount || 0));
        const commissionPercent = Math.min(
          100,
          Math.max(0, toNumber(item.commissionPercent, 20))
        );
        const commission = Math.round(amount * (commissionPercent / 100));
        const fallback = Math.max(0, amount - commission);
        const earnings =
          Number.isNaN(explicit) ||
          (explicit === 0 && fallback > 0 && commissionPercent < 100)
            ? fallback
            : explicit;
        return sum + earnings;
      },
      0
    );
    const merchandiseRevenue = paidMerchOrders.reduce(
      (sum, order) => sum + Math.max(0, toNumber(order?.totalAmount || 0)),
      0
    );
    const merchandisePlatformCommission = paidMerchOrders.reduce(
      (sum, order) => sum + Math.max(0, toNumber(order?.platformCommissionAmount || 0)),
      0
    );
    const merchandiseOrganizerEarnings = paidMerchOrders.reduce(
      (sum, order) => {
        const total = Math.max(0, toNumber(order?.totalAmount || 0));
        const explicit = toNumber(order?.organizerEarningsAmount, Number.NaN);
        const commission = Math.max(
          0,
          toNumber(order?.platformCommissionAmount, 0)
        );
        return sum + (Number.isNaN(explicit) ? Math.max(0, total - commission) : explicit);
      },
      0
    );

    const ticketRevenue = collectedFunds;
    const totalRevenue =
      ticketRevenue + competitionRevenue + merchandiseRevenue;
    const platformCommissionTotal =
      ticketPlatformCommission +
      competitionPlatformCommission +
      merchandisePlatformCommission;
    const organizerEarningsTotal =
      ticketOrganizerEarnings +
      competitionOrganizerEarnings +
      merchandiseOrganizerEarnings;

    const reservedStatuses = new Set([
      'pending',
      'pending_email_approval',
      'approved',
    ]);
    const reservedDisbursementAmount = fundRequests
      .filter((item) => reservedStatuses.has(String(item?.status || '')))
      .reduce((sum, item) => sum + toNumber(item?.amount || 0), 0);
    const approvedDisbursementAmount = fundRequests
      .filter((item) => String(item?.status || '') === 'approved')
      .reduce((sum, item) => sum + toNumber(item?.amount || 0), 0);
    const pendingDisbursementAmount = fundRequests
      .filter((item) =>
        ['pending', 'pending_email_approval'].includes(
          String(item?.status || '')
        )
      )
      .reduce((sum, item) => sum + toNumber(item?.amount || 0), 0);

    const fundsAvailableForDisbursement = Math.max(
      0,
      organizerEarningsTotal - reservedDisbursementAmount
    );

    const packageMap = new Map();
    for (const tx of paidCompetitionTransactions) {
      const key = String(tx.packageName || 'Package').trim() || 'Package';
      const current = packageMap.get(key) || {
        name: key,
        votes: 0,
        revenue: 0,
        transactions: 0,
      };
      current.votes += Number(tx.votes || 0);
      current.revenue += Number(tx.totalAmount || 0);
      current.transactions += 1;
      packageMap.set(key, current);
    }

    const contestantMap = new Map();
    for (const tx of paidCompetitionTransactions) {
      const name =
        String(tx.contestantName || 'Contestant').trim() || 'Contestant';
      const category =
        String(tx.contestantCategory || 'General').trim() || 'General';
      const key = `${name}::${category}`;
      const current = contestantMap.get(key) || {
        name,
        category,
        votes: 0,
        revenue: 0,
        transactions: 0,
      };
      current.votes += Number(tx.votes || 0);
      current.revenue += Number(tx.totalAmount || 0);
      current.transactions += 1;
      contestantMap.set(key, current);
    }

    const competitionByPackage = Array.from(packageMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    const competitionByContestant = Array.from(contestantMap.values()).sort(
      (a, b) => b.votes - a.votes
    );

    const ticketByEvent = new Map();
    const ticketCommissionByEvent = new Map();
    for (const order of paidOrders) {
      const key = String(order?.eventId || '');
      const amount = Math.max(0, toNumber(order?.totalAmount || 0));
      const commissionPercent = Math.min(
        100,
        Math.max(0, toNumber(order?.commissionPercent, 20))
      );
      const commissionFromRate = Math.round(amount * (commissionPercent / 100));
      const explicitCommission = toNumber(
        order?.platformCommissionAmount,
        Number.NaN
      );
      const commission =
        Number.isNaN(explicitCommission) ||
        (explicitCommission === 0 && commissionFromRate > 0)
          ? commissionFromRate
          : explicitCommission;
      ticketByEvent.set(key, (ticketByEvent.get(key) || 0) + amount);
      ticketCommissionByEvent.set(
        key,
        (ticketCommissionByEvent.get(key) || 0) + commission
      );
    }

    const competitionByEvent = new Map();
    for (const tx of paidCompetitionTransactions) {
      const key = String(tx?.eventId || '');
      const current = competitionByEvent.get(key) || {
        revenue: 0,
        votes: 0,
        platformCommission: 0,
        organizerEarnings: 0,
      };
      const amount = toNumber(tx?.totalAmount || 0);
      const explicitCommission = toNumber(
        tx?.platformCommissionAmount,
        Number.NaN
      );
      const commission = Number.isNaN(explicitCommission)
        ? Math.round(amount * (toNumber(tx?.commissionPercent, 20) / 100))
        : explicitCommission;
      const explicitEarnings = toNumber(
        tx?.organizerEarningsAmount,
        Number.NaN
      );
      const earnings = Number.isNaN(explicitEarnings)
        ? Math.max(0, amount - commission)
        : explicitEarnings;

      current.revenue += amount;
      current.votes += Math.max(0, toNumber(tx?.votes || 0));
      current.platformCommission += commission;
      current.organizerEarnings += earnings;
      competitionByEvent.set(key, current);
    }

    const approvedEventRevenueBreakdown = approvedEvents
      .map((event) => {
        const eventId = String(event?._id || '');
        const ticketRevenueForEvent = toNumber(ticketByEvent.get(eventId) || 0);
        const ticketCommissionForEvent = toNumber(
          ticketCommissionByEvent.get(eventId) || 0
        );
        const competitionForEvent = competitionByEvent.get(eventId) || {
          revenue: 0,
          votes: 0,
          platformCommission: 0,
          organizerEarnings: 0,
        };
        const totalRevenueForEvent =
          ticketRevenueForEvent + competitionForEvent.revenue;
        const organizerEarningsForEvent = Math.max(
          0,
          ticketRevenueForEvent -
            ticketCommissionForEvent +
            competitionForEvent.organizerEarnings
        );
        const reserveShare =
          organizerEarningsTotal > 0
            ? (reservedDisbursementAmount * organizerEarningsForEvent) /
              organizerEarningsTotal
            : 0;

        return {
          eventId,
          title: String(event?.title || 'Untitled event'),
          startDateTime: event?.startDateTime || null,
          endDateTime: event?.endDateTime || null,
          competitionRevenue: competitionForEvent.revenue,
          paidCompetitionVotes: competitionForEvent.votes,
          ticketRevenue: ticketRevenueForEvent,
          totalRevenue: totalRevenueForEvent,
          platformCommission:
            ticketCommissionForEvent + competitionForEvent.platformCommission,
          organizerEarnings: organizerEarningsForEvent,
          fundsAvailableForDisbursement: Math.max(
            0,
            organizerEarningsForEvent - reserveShare
          ),
        };
      })
      .sort((a, b) => {
        return (
          new Date(b.startDateTime || 0).getTime() -
          new Date(a.startDateTime || 0).getTime()
        );
      })
      .filter((row) => {
        if (!hasSelectedEvent) return true;
        return row.eventId === selectedEventId;
      });

    const eventsWithContestantStatus = scopedToSelectedEvents.map((event) => ({
      ...event,
      contestantStatus:
        String(event?.eventType || '') === 'competition'
          ? mapContestantStatus(event)
          : [],
    }));

    return NextResponse.json({
      success: true,
      events: eventsWithContestantStatus,
      stats: {
        collectedFunds,
        soldTickets,
        paidOrders: paidOrders.length,
        competitionRevenue,
        competitionVotes,
        paidCompetitionTransactions: paidCompetitionTransactions.length,
        merchandiseRevenue,
        paidMerchOrders: paidMerchOrders.length,
        merchandiseUnits: paidMerchOrders.reduce(
          (sum, order) => sum + Math.max(0, toNumber(order?.quantity || 0)),
          0
        ),
        totalRevenue,
        platformCommission: platformCommissionTotal,
        organizerEarnings: organizerEarningsTotal,
        fundsAvailableForDisbursement,
        reservedDisbursementAmount,
        approvedDisbursementAmount,
        pendingDisbursementAmount,
      },
      competitionAnalytics: {
        byPackage: competitionByPackage,
        byContestant: competitionByContestant,
      },
      ticketSalesByContestant,
      approvedEventRevenueBreakdown,
      availableEvents,
      activeEvent,
      organizer: {
        organizationName: organizer.organizationName,
        contactName: organizer.contactName,
        email: organizer.email,
        phone: organizer.phone,
        county: organizer.county || '',
        subCounty: organizer.subCounty || '',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to fetch organizer events',
      },
      { status: 500 }
    );
  }
}
