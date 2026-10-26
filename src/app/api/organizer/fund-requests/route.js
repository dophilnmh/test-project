import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';
import FundRequest from '@/app/models/FundRequest';
import TicketOrder from '@/app/models/TicketOrder';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import MerchOrder from '@/app/models/MerchOrder';
import MerchProduct from '@/app/models/MerchProduct';
import Event from '@/app/models/Event';
import { auth } from '@/app/auth';
import mongoose from 'mongoose';

function normalizePhone(value) {
  const trimmed = String(value || '').replace(/\s+/g, '');
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  return '';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeVoteNetAmount(tx) {
  const totalAmount = toNumber(tx?.totalAmount || 0);
  const explicitEarnings = toNumber(tx?.organizerEarningsAmount, Number.NaN);
  if (!Number.isNaN(explicitEarnings)) return Math.max(0, explicitEarnings);

  const explicitCommission = toNumber(tx?.platformCommissionAmount, Number.NaN);
  if (!Number.isNaN(explicitCommission)) {
    return Math.max(0, totalAmount - explicitCommission);
  }

  const commissionPercent = Math.min(
    100,
    Math.max(0, toNumber(tx?.commissionPercent, 20))
  );
  const inferredCommission = Math.round(
    totalAmount * (commissionPercent / 100)
  );
  return Math.max(0, totalAmount - inferredCommission);
}

function computeMerchNetAmount(order) {
  const amount = toNumber(order?.totalAmount || 0);
  const explicitEarnings = toNumber(order?.organizerEarningsAmount, Number.NaN);
  if (!Number.isNaN(explicitEarnings)) return Math.max(0, explicitEarnings);

  const explicitCommission = toNumber(
    order?.platformCommissionAmount,
    Number.NaN
  );
  if (!Number.isNaN(explicitCommission)) {
    return Math.max(0, amount - explicitCommission);
  }

  const commissionPercent = Math.min(
    100,
    Math.max(0, toNumber(order?.commissionPercent, 0))
  );
  return Math.max(0, amount - Math.round(amount * (commissionPercent / 100)));
}

export async function GET() {
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

    const requests = await FundRequest.find({ organizerId: organizer._id })
      .sort({ createdAt: -1 })
      .lean();

    const [paidOrders, paidCompetitionTransactions, paidMerchOrders] =
      await Promise.all([
        TicketOrder.find({
          organizerId: organizer._id,
          status: 'paid',
        })
          .select('totalAmount')
          .lean(),
        CompetitionVoteTransaction.find({
          organizerId: organizer._id,
          status: 'paid',
        })
          .select(
            'totalAmount organizerEarningsAmount platformCommissionAmount commissionPercent'
          )
          .lean(),
        MerchOrder.find({
          organizerId: organizer._id,
          paymentStatus: 'paid',
        })
          .select(
            'totalAmount organizerEarningsAmount platformCommissionAmount commissionPercent'
          )
          .lean(),
      ]);

    const ticketRevenue = paidOrders.reduce(
      (sum, item) => sum + toNumber(item?.totalAmount || 0),
      0
    );
    const competitionOrganizerEarnings = paidCompetitionTransactions.reduce(
      (sum, tx) => sum + computeVoteNetAmount(tx),
      0
    );
    const merchandiseOrganizerEarnings = paidMerchOrders.reduce(
      (sum, order) => sum + computeMerchNetAmount(order),
      0
    );
    const organizerEarningsTotal =
      ticketRevenue + competitionOrganizerEarnings + merchandiseOrganizerEarnings;

    const reservedStatuses = new Set([
      'pending',
      'pending_email_approval',
      'approved',
    ]);
    const reservedDisbursementAmount = requests
      .filter((item) => reservedStatuses.has(String(item?.status || '')))
      .reduce((sum, item) => sum + toNumber(item?.amount || 0), 0);

    const fundsAvailableForDisbursement = Math.max(
      0,
      organizerEarningsTotal - reservedDisbursementAmount
    );

    return NextResponse.json({
      success: true,
      requests,
      funds: {
        organizerEarnings: organizerEarningsTotal,
        reservedDisbursementAmount,
        fundsAvailableForDisbursement,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load requests' },
      { status: 500 }
    );
  }
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
    const mpesaNumber = normalizePhone(body?.mpesaNumber);
    const accountName = String(body?.accountName || '').trim();
    const amount = Math.max(0, Number(body?.amount || 0));
    const requestPurpose = String(body?.requestPurpose || '').trim();
    const eventId = String(body?.eventId || '').trim();
    const sourceType =
      String(body?.sourceType || 'event').trim().toLowerCase() ===
      'merchandise'
        ? 'merchandise'
        : 'event';
    const merchProductId = String(body?.merchProductId || '').trim();

    if (
      (sourceType === 'event' && !eventId) ||
      (sourceType === 'merchandise' && !merchProductId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Select an approved event or merchandise shop for these funds',
        },
        { status: 400 }
      );
    }

    let event = null;
    let merchProduct = null;
    if (sourceType === 'event') {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return NextResponse.json(
          { success: false, message: 'Select a valid approved event.' },
          { status: 400 }
        );
      }
      event = await Event.findOne({
        _id: eventId,
        organizerId: organizer._id,
        status: 'approved',
      })
        .select('title')
        .lean();
    } else {
      if (!mongoose.Types.ObjectId.isValid(merchProductId)) {
        return NextResponse.json(
          { success: false, message: 'Select a valid merchandise shop.' },
          { status: 400 }
        );
      }
      merchProduct = await MerchProduct.findOne({
        _id: merchProductId,
        organizerId: organizer._id,
        approvalStatus: 'approved',
      })
        .select('name')
        .lean();
    }

    if (!event && !merchProduct) {
      return NextResponse.json(
        {
          success: false,
          message: 'Selected source was not found among your approved events or shops',
        },
        { status: 400 }
      );
    }

    if (!mpesaNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Enter a valid M-PESA number in 07XXXXXXXX or 2547XXXXXXXX format',
        },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Withdrawal amount must be greater than 0' },
        { status: 400 }
      );
    }

    const [
      paidOrders,
      paidCompetitionTransactions,
      paidMerchOrders,
      existingRequests,
    ] =
      await Promise.all([
        TicketOrder.find({
          organizerId: organizer._id,
          status: 'paid',
        })
          .select('totalAmount')
          .lean(),
        CompetitionVoteTransaction.find({
          organizerId: organizer._id,
          status: 'paid',
        })
          .select(
            'totalAmount organizerEarningsAmount platformCommissionAmount commissionPercent'
          )
          .lean(),
        MerchOrder.find({
          organizerId: organizer._id,
          paymentStatus: 'paid',
        })
          .select(
            'totalAmount organizerEarningsAmount platformCommissionAmount commissionPercent'
          )
          .lean(),
        FundRequest.find({ organizerId: organizer._id })
          .select('amount status')
          .lean(),
      ]);

    const ticketRevenue = paidOrders.reduce(
      (sum, item) => sum + toNumber(item?.totalAmount || 0),
      0
    );
    const competitionOrganizerEarnings = paidCompetitionTransactions.reduce(
      (sum, tx) => sum + computeVoteNetAmount(tx),
      0
    );
    const merchandiseOrganizerEarnings = paidMerchOrders.reduce(
      (sum, order) => sum + computeMerchNetAmount(order),
      0
    );
    const organizerEarningsTotal =
      ticketRevenue + competitionOrganizerEarnings + merchandiseOrganizerEarnings;

    const reservedStatuses = new Set([
      'pending',
      'pending_email_approval',
      'approved',
    ]);
    const reservedDisbursementAmount = existingRequests
      .filter((item) => reservedStatuses.has(String(item?.status || '')))
      .reduce((sum, item) => sum + toNumber(item?.amount || 0), 0);

    const fundsAvailableForDisbursement = Math.max(
      0,
      organizerEarningsTotal - reservedDisbursementAmount
    );

    if (amount > fundsAvailableForDisbursement) {
      return NextResponse.json(
        {
          success: false,
          message: `Requested amount exceeds available disbursement balance (${Math.round(
            fundsAvailableForDisbursement
          )}).`,
          fundsAvailableForDisbursement,
        },
        { status: 400 }
      );
    }

    const request = await FundRequest.create({
      organizerId: organizer._id,
      organizerName: organizer.organizationName,
      organizerEmail: organizer.email,
      organizerPhone: organizer.phone,
      eventId: event?._id || null,
      sourceType,
      merchProductId: merchProduct?._id || null,
      eventTitle: event?.title || `Merchandise: ${merchProduct.name}`,
      mpesaNumber,
      accountName,
      amount,
      requestPurpose,
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      message: 'Fund request submitted for admin review',
      request,
      fundsAvailableForDisbursement: Math.max(
        0,
        fundsAvailableForDisbursement - amount
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to submit request' },
      { status: 500 }
    );
  }
}
