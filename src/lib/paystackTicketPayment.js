import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import TicketOrder from '@/app/models/TicketOrder';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import MerchOrder from '@/app/models/MerchOrder';
import MerchProduct from '@/app/models/MerchProduct';
import Organizer from '@/app/models/Organizer';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';
import {
  buildTicketPdfBuffer,
  buildTicketQrPayload,
  createEntryCode,
  createTicketCode,
} from '@/lib/ticketing';

async function createUniqueTicketCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createTicketCode();
    if (!(await TicketOrder.exists({ ticketCode: code }))) return code;
  }
  throw new Error('Could not create a unique ticket code.');
}

export async function finalizePaystackTicket(reference) {
  const secretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!secretKey) {
    throw new Error(
      'Missing required environment variable: PAYSTACK_SECRET_KEY'
    );
  }

  await connect();
  const order = await TicketOrder.findOne({ checkoutRequestId: reference });
  if (!order) {
    const voteTransaction = await CompetitionVoteTransaction.findOne({
      checkoutRequestId: reference,
    });
    const merchOrder = await MerchOrder.findOne({
      paymentReference: reference,
    });
    const paymentRecord = voteTransaction || merchOrder;
    if (!paymentRecord) {
      return { success: false, message: 'Payment record not found.' };
    }
    const isMerchOrder = Boolean(merchOrder);
    const currentStatus = isMerchOrder
      ? merchOrder.paymentStatus
      : voteTransaction.status;
    if (currentStatus === 'paid') {
      return {
        success: true,
        paid: true,
        paymentType: isMerchOrder ? 'merchandise' : 'competition_vote',
        order: paymentRecord,
      };
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` }, cache: 'no-store' }
    );
    const verification = await response.json();
    const transaction = verification?.data;
    if (!response.ok || !verification?.status || !transaction) {
      return {
        success: false,
        message: 'Paystack could not verify this payment.',
      };
    }

    if (transaction.status !== 'success') {
      if (isMerchOrder) {
        const failedOrder = await MerchOrder.findOneAndUpdate(
          { _id: merchOrder._id, paymentStatus: { $ne: 'paid' } },
          { $set: { paymentStatus: 'failed' } },
          { new: true }
        );
        if (failedOrder) {
          const product = await MerchProduct.findByIdAndUpdate(
            merchOrder.productId,
            { $inc: { stock: merchOrder.quantity } },
            { new: true }
          );
          if (product?.status === 'out_of_stock' && product.stock > 0) {
            product.status = 'active';
            await product.save();
          }
        }
      } else {
        voteTransaction.status = 'failed';
        voteTransaction.resultDesc =
          transaction.gateway_response || 'Card payment failed.';
        await voteTransaction.save();
      }
      return {
        success: true,
        paid: false,
        paymentType: isMerchOrder ? 'merchandise' : 'competition_vote',
        message:
          transaction.gateway_response || 'Card payment was not completed.',
      };
    }

    const expectedAmount = Math.round(
      Number(paymentRecord.totalAmount || 0) * 100
    );
    if (
      transaction.reference !== reference ||
      String(transaction.currency || '').toUpperCase() !== 'KES' ||
      Number(transaction.amount) !== expectedAmount
    ) {
      return {
        success: false,
        paymentType: isMerchOrder ? 'merchandise' : 'competition_vote',
        message: 'Verified payment details did not match the order.',
      };
    }

    if (isMerchOrder) {
      const paidOrder = await MerchOrder.findOneAndUpdate(
        { _id: merchOrder._id, paymentStatus: { $ne: 'paid' } },
        { $set: { paymentStatus: 'paid', paidAt: new Date() } },
        { new: true }
      );
      const latestOrder =
        paidOrder || (await MerchOrder.findById(merchOrder._id));
      return {
        success: latestOrder?.paymentStatus === 'paid',
        paid: latestOrder?.paymentStatus === 'paid',
        paymentType: 'merchandise',
        order: latestOrder,
      };
    }

    const paidTransaction = await CompetitionVoteTransaction.findOneAndUpdate(
      { _id: voteTransaction._id, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          resultCode: 0,
          resultDesc: 'Paystack card payment verified.',
        },
      },
      { new: true }
    );
    if (paidTransaction) {
      const event = await Event.findById(paidTransaction.eventId);
      const contestant = (event?.competition?.contestants || []).find(
        (item) => {
          const key = `${String(item.fullName || '')
            .trim()
            .toLowerCase()}::${String(item.category || '')
            .trim()
            .toLowerCase()}`;
          return key === String(paidTransaction.contestantKey || '');
        }
      );
      if (!event || !contestant) {
        paidTransaction.status = 'failed';
        paidTransaction.resultDesc =
          'Contestant could not be found after payment.';
        await paidTransaction.save();
        return { success: false, message: paidTransaction.resultDesc };
      }
      contestant.votes = Math.max(
        0,
        Number(contestant.votes || 0) + Number(paidTransaction.votes || 0)
      );
      event.markModified('competition.contestants');
      await event.save();
    }
    const latestTransaction =
      paidTransaction ||
      (await CompetitionVoteTransaction.findById(voteTransaction._id));
    return {
      success: latestTransaction?.status === 'paid',
      paid: latestTransaction?.status === 'paid',
      paymentType: 'competition_vote',
      order: latestTransaction,
    };
  }

  if (!order) return { success: false, message: 'Ticket order not found.' };
  if (order.status === 'paid') return { success: true, paid: true, order };

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` }, cache: 'no-store' }
  );
  const verification = await response.json();
  const transaction = verification?.data;

  if (!response.ok || !verification?.status || !transaction) {
    return {
      success: false,
      message: 'Paystack could not verify this payment.',
    };
  }

  if (transaction.status !== 'success') {
    if (order.status === 'pending') {
      order.status = 'failed';
      order.resultDesc = transaction.gateway_response || 'Card payment failed.';
      await order.save();
    }
    return {
      success: true,
      paid: false,
      message:
        transaction.gateway_response || 'Card payment was not completed.',
    };
  }

  const expectedAmount = Math.round(Number(order.totalAmount || 0) * 100);
  if (
    transaction.reference !== reference ||
    String(transaction.currency || '').toUpperCase() !== 'KES' ||
    Number(transaction.amount) !== expectedAmount
  ) {
    return {
      success: false,
      message: 'Verified payment details did not match the ticket order.',
    };
  }

  const event = await Event.findById(order.eventId);
  const tier = (event?.tiers || []).find(
    (item) => item.name === order.tierName
  );
  if (!event || !tier) {
    return {
      success: false,
      message: 'The event ticket tier could not be found.',
    };
  }

  const ticketCode = order.ticketCode || (await createUniqueTicketCode());
  const entryCode = order.entryCode || createEntryCode();
  const commissionPercent = Math.min(
    100,
    Math.max(0, Number(order.commissionPercent ?? 20))
  );
  const platformCommissionAmount = Math.round(
    Number(order.totalAmount || 0) * (commissionPercent / 100)
  );
  const organizerEarningsAmount = Math.max(
    0,
    Number(order.totalAmount || 0) - platformCommissionAmount
  );
  const paidOrder = await TicketOrder.findOneAndUpdate(
    { _id: order._id, status: { $ne: 'paid' } },
    {
      $set: {
        status: 'paid',
        ticketCode,
        entryCode,
        commissionPercent,
        platformCommissionAmount,
        organizerEarningsAmount,
        entryStatus: 'pending',
        paidAt: new Date(),
        resultCode: 0,
        resultDesc: 'Paystack payment verified.',
      },
    },
    { new: true }
  );

  if (!paidOrder) {
    const latestOrder = await TicketOrder.findById(order._id);
    return {
      success: latestOrder?.status === 'paid',
      paid: latestOrder?.status === 'paid',
      order: latestOrder,
    };
  }

  tier.remainingSlots = Math.max(
    0,
    Number(tier.remainingSlots || 0) - Number(paidOrder.quantity || 0)
  );
  await event.save();

  const email = String(paidOrder.customerEmail || '').trim();
  const phone = String(paidOrder.customerPhone || '').trim();
  const qrPayload = buildTicketQrPayload({ ticketCode, entryCode });
  const ticketPdf = await buildTicketPdfBuffer({
    order: paidOrder,
    event,
    customerEmail: email,
  });

  if (email) {
    const emailResult = await sendMailSafe({
      to: email,
      subject: `Ticket Confirmed: ${event.title}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><h2>Ticket Purchase Confirmed</h2><p>Your card payment was received and your ticket is confirmed.</p><p><strong>Event:</strong> ${event.title}<br><strong>Tier:</strong> ${paidOrder.tierName}<br><strong>Quantity:</strong> ${paidOrder.quantity}<br><strong>Amount:</strong> KES ${paidOrder.totalAmount}<br><strong>Ticket Code:</strong> ${ticketCode}<br><strong>Entry Code:</strong> ${entryCode}<br><strong>Payment Reference:</strong> ${reference}</p><p>QR data: ${qrPayload}</p></div>`,
      text: `Ticket confirmed for ${event.title}. Tier: ${paidOrder.tierName}. Quantity: ${paidOrder.quantity}. Ticket code: ${ticketCode}. Entry code: ${entryCode}. Payment reference: ${reference}.`,
      attachments: [
        {
          filename: `${ticketCode.toLowerCase()}.pdf`,
          content: ticketPdf,
          contentType: 'application/pdf',
        },
      ],
    });
    if (emailResult?.ok) {
      paidOrder.ticketPdfSentAt = new Date();
      await paidOrder.save();
    }
  }

  if (phone) {
    await sendSmsSafe({
      phone,
      message: `Ticket confirmed for ${event.title}. Code: ${entryCode}. Ticket: ${ticketCode}. Show both at entry.`,
    });
  }

  const organizer = event.organizerId
    ? await Organizer.findById(event.organizerId).lean()
    : null;
  if (organizer?.email) {
    await sendMailSafe({
      to: organizer.email,
      subject: `Ticket Sold: ${event.title}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><h2>Ticket Sold</h2><p><strong>Event:</strong> ${event.title}<br><strong>Tier:</strong> ${paidOrder.tierName}<br><strong>Quantity:</strong> ${paidOrder.quantity}<br><strong>Ticket Code:</strong> ${ticketCode}<br><strong>Entry Code:</strong> ${entryCode}</p></div>`,
      text: `A ticket purchase was completed for ${event.title}. Ticket code: ${ticketCode}. Entry code: ${entryCode}.`,
    });
  }

  return { success: true, paid: true, order: paidOrder };
}
