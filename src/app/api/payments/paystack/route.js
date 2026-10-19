import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Event from '@/app/models/Event';
import TicketOrder from '@/app/models/TicketOrder';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import MerchProduct from '@/app/models/MerchProduct';
import MerchOrder from '@/app/models/MerchOrder';
import User from '@/app/models/User';
import { createEntryCode, createTicketCode } from '@/lib/ticketing';
import { resolveTicketReferral } from '@/lib/ticketReferral';

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

async function restoreMerchandiseStock(productId, quantity) {
  const product = await MerchProduct.findByIdAndUpdate(
    productId,
    { $inc: { stock: quantity } },
    { new: true }
  );
  if (product?.status === 'out_of_stock' && product.stock > 0) {
    product.status = 'active';
    await product.save();
  }
}

export async function POST(request) {
  try {
    const secretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!secretKey) {
      return NextResponse.json(
        { success: false, message: 'Card payments are not configured yet.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const paymentType = String(body.paymentType || 'ticket')
      .trim()
      .toLowerCase();
    const eventId = String(body.eventId || '').trim();
    const tierName = String(body.tierName || '').trim();
    const quantity = Math.max(1, Math.round(Number(body.quantity || 1)));
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const phone = String(body.phone || '').trim();

    if (!isValidEmail(email) || (phone && phone.length < 7)) {
      return NextResponse.json(
        { success: false, message: 'Enter a valid email and phone number.' },
        { status: 400 }
      );
    }

    await connect();

    if (paymentType === 'competition_vote') {
      const contestantKey = String(
        body.contestantKey || body.contestantId || ''
      )
        .trim()
        .toLowerCase();
      const packageId = String(body.packageId || '').trim();
      const requestedVotes = Math.max(
        1,
        Math.round(Number(body.requestedVotes || 1))
      );
      const event = await Event.findById(eventId);
      if (
        !event ||
        event.status !== 'approved' ||
        event.eventType !== 'competition'
      ) {
        return NextResponse.json(
          { success: false, message: 'Competition not available for voting.' },
          { status: 404 }
        );
      }

      const maxVotes = Math.max(
        1,
        Math.round(Number(event.competition?.maxVotesPerTransaction || 1000))
      );
      if (requestedVotes > maxVotes) {
        return NextResponse.json(
          {
            success: false,
            message: `Maximum votes per transaction is ${maxVotes}.`,
          },
          { status: 400 }
        );
      }

      const now = Date.now();
      if (
        now < new Date(event.startDateTime).getTime() ||
        now > new Date(event.endDateTime).getTime()
      ) {
        return NextResponse.json(
          { success: false, message: 'Voting is not currently open.' },
          { status: 400 }
        );
      }

      const contestant = (event.competition?.contestants || []).find((item) => {
        const key = `${String(item.fullName || '')
          .trim()
          .toLowerCase()}::${String(item.category || '')
          .trim()
          .toLowerCase()}`;
        return key === contestantKey;
      });
      const votePackage = (event.competition?.votePackages || []).find(
        (item) =>
          item?.isActive !== false && String(item._id || '') === packageId
      );
      if (!contestant || !votePackage) {
        return NextResponse.json(
          {
            success: false,
            message: 'Contestant or voting package not found.',
          },
          { status: 400 }
        );
      }

      const votesPerPackage = Math.max(1, Number(votePackage.votes || 1));
      const unitPrice = Math.max(1, Math.round(Number(votePackage.price || 0)));
      const totalAmount = Math.max(
        1,
        Math.round((unitPrice / votesPerPackage) * requestedVotes)
      );
      const commissionPercent = Number(
        event.commercialTerms?.votingCommissionPercent ?? 20
      );
      const reference = `NIMBLY-${randomUUID()}`;
      const transaction = await CompetitionVoteTransaction.create({
        eventId: event._id,
        organizerId: event.organizerId || null,
        contestantKey,
        contestantName: contestant.fullName,
        contestantCategory: contestant.category,
        packageId: String(votePackage._id || ''),
        packageName: votePackage.name,
        voterEmail: email,
        voterPhone: phone || 'CARD',
        votes: requestedVotes,
        unitPrice: Math.round(totalAmount / requestedVotes),
        totalAmount,
        commissionPercent,
        platformCommissionAmount: Math.round(
          totalAmount * (commissionPercent / 100)
        ),
        organizerEarningsAmount: Math.max(
          0,
          totalAmount - Math.round(totalAmount * (commissionPercent / 100))
        ),
        status: 'pending',
        checkoutRequestId: reference,
        resultDesc: 'Awaiting Paystack card payment.',
      });

      const callbackUrl = new URL(
        '/api/payments/paystack/callback',
        request.url
      );
      callbackUrl.searchParams.set('returnTo', `/competitions/${eventId}`);
      const gatewayResponse = await fetch(
        'https://api.paystack.co/transaction/initialize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: totalAmount * 100,
            currency: 'KES',
            channels: ['card'],
            reference,
            callback_url: callbackUrl.toString(),
            metadata: {
              paymentType,
              transactionId: String(transaction._id),
              eventId,
            },
          }),
        }
      );
      const gatewayData = await gatewayResponse.json();
      if (
        !gatewayResponse.ok ||
        !gatewayData?.status ||
        !gatewayData?.data?.access_code
      ) {
        transaction.status = 'failed';
        transaction.resultDesc =
          gatewayData?.message || 'Paystack initialization failed.';
        await transaction.save();
        return NextResponse.json(
          { success: false, message: transaction.resultDesc },
          { status: 502 }
        );
      }
      transaction.merchantRequestId = gatewayData.data.access_code;
      await transaction.save();
      return NextResponse.json({
        success: true,
        accessCode: gatewayData.data.access_code,
        reference,
      });
    }

    if (paymentType === 'merchandise' || paymentType === 'merch') {
      const session = await auth();
      if (!session?.user?.email || session.user.email.toLowerCase() !== email) {
        return NextResponse.json(
          {
            success: false,
            message: 'Sign in with the email used for checkout.',
          },
          { status: 401 }
        );
      }
      const productId = String(body.productId || '').trim();
      const productQuantity = Math.max(
        1,
        Math.floor(Number(body.quantity || 1))
      );
      const deliveryLocation = String(body.deliveryLocation || '').trim();
      if (!productId || !deliveryLocation) {
        return NextResponse.json(
          {
            success: false,
            message: 'Product and delivery location are required.',
          },
          { status: 400 }
        );
      }
      const product = await MerchProduct.findOneAndUpdate(
        {
          _id: productId,
          status: 'active',
          approvalStatus: 'approved',
          stock: { $gte: productQuantity },
        },
        { $inc: { stock: -productQuantity } },
        { new: true }
      );
      if (!product) {
        return NextResponse.json(
          { success: false, message: 'Product unavailable or out of stock.' },
          { status: 409 }
        );
      }
      if (product.stock <= 0) {
        product.status = 'out_of_stock';
        await product.save();
      }
      const totalAmount = Math.round(
        Number(product.price || 0) * productQuantity
      );
      if (totalAmount <= 0) {
        await restoreMerchandiseStock(product._id, productQuantity);
        return NextResponse.json(
          {
            success: false,
            message: 'Product amount must be greater than zero.',
          },
          { status: 400 }
        );
      }
      const superadmin = await User.findOne({ role: 'superadmin' })
        .select('merchandiseCommissionPercent')
        .lean();
      const event = product.eventId
        ? await Event.findById(product.eventId).select('commercialTerms').lean()
        : null;
      const commissionPercent = Math.min(
        100,
        Math.max(
          0,
          Number(
            product.commissionPercent ??
              event?.commercialTerms?.merchandiseCommissionPercent ??
              superadmin?.merchandiseCommissionPercent ??
              process.env.MERCH_PLATFORM_COMMISSION_PERCENT ??
              15
          )
        )
      );
      const platformCommissionAmount = Math.round(
        totalAmount * (commissionPercent / 100)
      );
      const reference = `NIMBLY-${randomUUID()}`;
      const order = await MerchOrder.create({
        productId: product._id,
        organizerId: product.organizerId || null,
        organizerName: product.organizerName || '',
        productName: product.name,
        unitPrice: product.price,
        quantity: productQuantity,
        totalAmount,
        commissionPercent,
        platformCommissionAmount,
        organizerEarningsAmount: Math.max(
          0,
          totalAmount - platformCommissionAmount
        ),
        currency: 'KSH',
        buyerEmail: email,
        buyerName: session.user.name || '',
        buyerPhone: phone,
        deliveryLocation,
        notes: String(body.notes || '').trim(),
        status: 'pending',
        paymentStatus: 'pending',
        paymentReference: reference,
      });
      const callbackUrl = new URL(
        '/api/payments/paystack/callback',
        request.url
      );
      callbackUrl.searchParams.set('returnTo', '/shop');
      const gatewayResponse = await fetch(
        'https://api.paystack.co/transaction/initialize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: totalAmount * 100,
            currency: 'KES',
            channels: ['card'],
            reference,
            callback_url: callbackUrl.toString(),
            metadata: {
              paymentType: 'merchandise',
              orderId: String(order._id),
            },
          }),
        }
      );
      const gatewayData = await gatewayResponse.json();
      if (
        !gatewayResponse.ok ||
        !gatewayData?.status ||
        !gatewayData?.data?.access_code
      ) {
        await MerchOrder.updateOne(
          { _id: order._id },
          { $set: { paymentStatus: 'failed' } }
        );
        await restoreMerchandiseStock(product._id, productQuantity);
        return NextResponse.json(
          {
            success: false,
            message:
              gatewayData?.message || 'Unable to initialize card checkout.',
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        accessCode: gatewayData.data.access_code,
        reference,
      });
    }

    if (!eventId || !tierName) {
      return NextResponse.json(
        { success: false, message: 'Event and ticket tier are required.' },
        { status: 400 }
      );
    }

    const event = await Event.findById(eventId);
    if (
      !event ||
      event.status !== 'approved' ||
      event.eventType === 'competition'
    ) {
      return NextResponse.json(
        { success: false, message: 'Event not available for ticket checkout.' },
        { status: 404 }
      );
    }

    const tier = (event.tiers || []).find((item) => item.name === tierName);
    if (!tier) {
      return NextResponse.json(
        { success: false, message: 'Selected ticket tier was not found.' },
        { status: 400 }
      );
    }
    if (tier.isActive === false) {
      return NextResponse.json(
        { success: false, message: 'This ticket type is no longer available.' },
        { status: 409 }
      );
    }
    if (quantity > Number(tier.remainingSlots || 0)) {
      return NextResponse.json(
        {
          success: false,
          message: `Only ${tier.remainingSlots} ${tierName} tickets remain.`,
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

    const amount = Math.round(Number(tier.price || 0) * quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Ticket amount must be greater than zero.' },
        { status: 400 }
      );
    }

    const reference = `NIMBLY-${randomUUID()}`;
    let ticketCode = '';
    let entryCode = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidateTicketCode = createTicketCode();
      const candidateEntryCode = createEntryCode();
      const existingCode = await TicketOrder.exists({
        $or: [
          { ticketCode: candidateTicketCode },
          { entryCode: candidateEntryCode },
        ],
      });
      if (!existingCode) {
        ticketCode = candidateTicketCode;
        entryCode = candidateEntryCode;
        break;
      }
    }

    if (!ticketCode || !entryCode) {
      return NextResponse.json(
        { success: false, message: 'Unable to reserve ticket codes.' },
        { status: 500 }
      );
    }

    const order = await TicketOrder.create({
      eventId: event._id,
      organizerId: event.organizerId,
      eventTitle: event.title,
      tierName: tier.name,
      quantity,
      unitPrice: Number(tier.price || 0),
      totalAmount: amount,
      commissionPercent: Number(
        event.commercialTerms?.ticketCommissionPercent ?? 20
      ),
      customerPhone: phone,
      customerEmail: email,
      referralCampaignId: referralResult.referral?.referralCampaignId || null,
      referralContestantId: referralResult.referral?.referralContestantId || '',
      referralContestantName:
        referralResult.referral?.referralContestantName || '',
      ticketCode,
      entryCode,
      status: 'pending',
      checkoutRequestId: reference,
      resultDesc: 'Awaiting Paystack card payment.',
    });

    const callbackUrl = new URL('/api/payments/paystack/callback', request.url);
    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: amount * 100,
          currency: 'KES',
          channels: ['card'],
          reference,
          callback_url: callbackUrl.toString(),
          metadata: {
            orderId: String(order._id),
            eventId: String(event._id),
            ticketTier: tier.name,
            quantity,
          },
        }),
      }
    );
    const data = await response.json();

    if (!response.ok || !data?.status || !data?.data?.authorization_url) {
      await TicketOrder.updateOne(
        { _id: order._id, status: 'pending' },
        {
          $set: {
            status: 'failed',
            resultDesc: 'Paystack initialization failed.',
          },
        }
      );
      return NextResponse.json(
        {
          success: false,
          message: data?.message || 'Unable to initialize Paystack checkout.',
        },
        { status: 502 }
      );
    }

    await TicketOrder.updateOne(
      { _id: order._id },
      { $set: { merchantRequestId: data.data.access_code || '' } }
    );

    return NextResponse.json({
      success: true,
      accessCode: data.data.access_code,
      reference,
    });
  } catch (error) {
    console.error('Paystack checkout initialization failed:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to start card checkout.' },
      { status: 500 }
    );
  }
}
