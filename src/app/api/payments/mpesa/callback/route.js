// /app/api/payments/mpesa/callback/route.js

import { NextResponse } from 'next/server';
import { setCheckoutStatus, getCheckoutStatus } from '@/lib/mpesaStatusStore';
import connect from '@/app/utils/db';
import TicketOrder from '@/app/models/TicketOrder';
import MerchOrder from '@/app/models/MerchOrder';
import MerchProduct from '@/app/models/MerchProduct';
import Event from '@/app/models/Event';
import VotingTransaction from '@/app/models/VotingTransaction';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import VotingCampaign from '@/app/models/VotingCampaign';
import Organizer from '@/app/models/Organizer';
import User from '@/app/models/User';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';
import {
  buildTicketPdfBuffer,
  buildTicketQrPayload,
  createEntryCode,
  createTicketCode,
} from '@/lib/ticketing';

async function notifyRecipient({
  email,
  phone,
  subject,
  html,
  text,
  smsMessage,
  smsEnabled = true,
  attachments,
}) {
  const notificationSummary = {
    email: Boolean(email),
    phone: Boolean(phone),
    emailTo: email || null,
    phoneTo: phone || null,
    subject,
    smsEnabled,
    smsMessage: smsMessage || null,
  };

  console.log('📣 NOTIFICATION ATTEMPT:', notificationSummary);

  const tasks = [];

  if (email) {
    tasks.push(
      sendMailSafe({
        to: email,
        subject,
        html,
        text,
        attachments,
      }).then((result) => {
        console.log('📧 EMAIL DELIVERY RESULT:', {
          to: email,
          subject,
          ok: result?.ok,
          message: result?.message,
          accepted: result?.accepted,
          rejected: result?.rejected,
          messageId: result?.messageId,
        });
        return result;
      })
    );
  }

  if (smsEnabled && phone && smsMessage) {
    tasks.push(
      sendSmsSafe({
        phone,
        message: smsMessage,
      }).then((result) => {
        console.log('📱 SMS DELIVERY RESULT:', {
          to: phone,
          ok: result?.ok,
          code: result?.code,
          message: result?.message,
          response: result?.response,
        });
        return result;
      })
    );
  }

  if (tasks.length === 0) {
    console.log('⚠️ No notifications to send - no email or phone provided');
    return;
  }

  const results = await Promise.allSettled(tasks);

  const outcome = results.map((result) => ({
    status: result.status,
    value: result.status === 'fulfilled' ? result.value : null,
    reason: result.status === 'rejected' ? result.reason : null,
  }));

  console.log('📊 NOTIFICATION SUMMARY:', outcome);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `❌ Notification delivery failed (${index + 1}):`,
        result.reason
      );
    }
  });
}

async function assignTicketIdentity(order) {
  // Only generate if ticketCode doesn't exist or is empty
  if (!order.ticketCode || order.ticketCode === '') {
    let attempts = 0;
    while (attempts < 5) {
      const candidate = createTicketCode();
      const exists = await TicketOrder.exists({ ticketCode: candidate });
      if (!exists) {
        order.ticketCode = candidate;
        break;
      }
      attempts += 1;
    }

    if (!order.ticketCode || order.ticketCode === '') {
      order.ticketCode = `NTP-${String(order._id).slice(-10).toUpperCase()}`;
    }
  }

  if (!order.entryCode || order.entryCode === '') {
    order.entryCode = createEntryCode();
  }

  if (!order.entryStatus || order.entryStatus === '') {
    order.entryStatus = 'pending';
  }

  console.log('✅ Ticket identity assigned:', {
    ticketCode: order.ticketCode,
    entryCode: order.entryCode,
    entryStatus: order.entryStatus,
  });
}

async function resolvePaymentFromCheckout(checkoutRequestId, hintedType) {
  const hint = String(hintedType || '').toLowerCase();

  if (hint === 'vote') {
    const transaction = await VotingTransaction.findOne({ checkoutRequestId });
    if (transaction) return { paymentType: 'vote', transaction };
  }

  if (hint === 'competition_vote') {
    const transaction = await CompetitionVoteTransaction.findOne({
      checkoutRequestId,
    });
    if (transaction) return { paymentType: 'competition_vote', transaction };
  }

  if (hint === 'ticket') {
    const order = await TicketOrder.findOne({ checkoutRequestId });
    if (order) return { paymentType: 'ticket', order };
  }

  if (hint === 'merchandise') {
    const order = await MerchOrder.findOne({ checkoutRequestId });
    if (order) return { paymentType: 'merchandise', merchOrder: order };
  }

  const [voteTx, competitionVoteTx, ticketOrder, merchOrder] = await Promise.all([
    VotingTransaction.findOne({ checkoutRequestId }),
    CompetitionVoteTransaction.findOne({ checkoutRequestId }),
    TicketOrder.findOne({ checkoutRequestId }),
    MerchOrder.findOne({ checkoutRequestId }),
  ]);

  if (voteTx) return { paymentType: 'vote', transaction: voteTx };
  if (competitionVoteTx)
    return { paymentType: 'competition_vote', transaction: competitionVoteTx };
  if (ticketOrder) return { paymentType: 'ticket', order: ticketOrder };
  if (merchOrder)
    return { paymentType: 'merchandise', merchOrder };

  return { paymentType: hint || 'ticket' };
}

export async function POST(req) {
  try {
    const payload = await req.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    const resultCode = Number(callback?.ResultCode ?? -1);
    const resultDesc = callback?.ResultDesc || 'Callback received';
    const items = callback?.CallbackMetadata?.Item || [];

    const findItemValue = (name) =>
      items.find((item) => item?.Name === name)?.Value ?? null;

    console.log('📞 MPESA CALLBACK RECEIVED:', {
      checkoutRequestId,
      resultCode,
      resultDesc,
      hasItems: items.length > 0,
    });

    if (checkoutRequestId) {
      await connect();
      const statusMeta = getCheckoutStatus(checkoutRequestId) || {};
      const hintedPaymentType = String(
        statusMeta.paymentType || 'ticket'
      ).toLowerCase();
      const resolvedPayment = await resolvePaymentFromCheckout(
        checkoutRequestId,
        hintedPaymentType
      );
      const paymentType = resolvedPayment.paymentType;
      const paid = resultCode === 0;

      console.log('📊 Payment resolution:', {
        paymentType,
        paid,
        hasTransaction: !!resolvedPayment.transaction,
        hasOrder: !!resolvedPayment.order,
      });

      if (paymentType === 'vote') {
        const transaction =
          resolvedPayment.transaction ||
          (await VotingTransaction.findOne({
            checkoutRequestId,
          }));
        if (transaction) {
          const wasAlreadyPaid = transaction.status === 'paid';
          transaction.status = paid ? 'paid' : 'failed';
          transaction.resultCode = resultCode;
          transaction.resultDesc = resultDesc;
          transaction.mpesaReceiptNumber =
            findItemValue('MpesaReceiptNumber') || '';
          if (paid) transaction.paidAt = new Date();
          await transaction.save();

          console.log('✅ Vote transaction updated:', {
            transactionId: transaction._id,
            status: transaction.status,
            wasAlreadyPaid,
          });

          if (paid && !wasAlreadyPaid) {
            const campaign = await VotingCampaign.findById(
              transaction.campaignId
            );
            if (campaign) {
              const contestant = (
                campaign.contestants ||
                campaign.nominees ||
                []
              ).find(
                (item) => String(item._id) === String(transaction.contestantId)
              );
              if (contestant) {
                contestant.voteCount = Math.max(
                  0,
                  Number(contestant.voteCount || 0) +
                    Number(transaction.votes || 0)
                );
              }
              campaign.totalVotes = Math.max(
                0,
                Number(campaign.totalVotes || 0) +
                  Number(transaction.votes || 0)
              );
              campaign.nominees = campaign.contestants || campaign.nominees;
              await campaign.save();

              const organizer = campaign.organizerId
                ? await Organizer.findById(campaign.organizerId).lean()
                : null;
              const superadmins = await User.find({ role: 'superadmin' })
                .select(
                  'email notificationPhone phone notificationEmailEnabled notificationSmsEnabled'
                )
                .lean();

              await notifyRecipient({
                email: transaction.voterEmail,
                phone: transaction.voterPhone,
                subject: 'Vote payment confirmed',
                html: `
                  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                    <h2>Vote Payment Confirmed</h2>
                    <p><strong>Campaign:</strong> ${campaign.title}</p>
                    <p><strong>Contestant:</strong> ${contestant?.name || transaction.contestantId}</p>
                    <p><strong>Votes:</strong> ${transaction.votes}</p>
                    <p><strong>Amount:</strong> ${transaction.totalAmount}</p>
                    <p><strong>Commission:</strong> ${transaction.platformCommissionAmount}</p>
                    <p><strong>Organizer earnings:</strong> ${transaction.organizerEarningsAmount}</p>
                  </div>
                `,
                text: `Vote payment confirmed for ${campaign.title}. Contestant: ${contestant?.name || transaction.contestantId}. Votes: ${transaction.votes}. Amount: ${transaction.totalAmount}.`,
                smsMessage: `Payment received. Your votes are recorded for ${campaign.title}. Contestant: ${contestant?.name || 'selected contestant'}. Votes: ${transaction.votes}.`,
                smsEnabled: true,
              });

              if (organizer?.email) {
                await notifyRecipient({
                  email: organizer.email,
                  phone: organizer.phone,
                  subject: 'New votes received',
                  html: `
                    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                      <h2>New Votes Received</h2>
                      <p><strong>Campaign:</strong> ${campaign.title}</p>
                      <p><strong>Contestant:</strong> ${contestant?.name || transaction.contestantId}</p>
                      <p><strong>Votes:</strong> ${transaction.votes}</p>
                      <p><strong>Organizer earnings:</strong> ${transaction.organizerEarningsAmount}</p>
                    </div>
                  `,
                  text: `New votes received for ${campaign.title}. Contestant: ${contestant?.name || transaction.contestantId}. Votes: ${transaction.votes}. Organizer earnings: ${transaction.organizerEarningsAmount}.`,
                  smsMessage: `New votes received for ${campaign.title}: ${transaction.votes} votes.`,
                  smsEnabled: organizer.notificationSmsEnabled !== false,
                });
              }

              for (const admin of superadmins) {
                await notifyRecipient({
                  email: admin.email,
                  phone: admin.notificationPhone || admin.phone,
                  subject: 'Voting revenue update',
                  html: `
                    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                      <h2>Voting Payment Processed</h2>
                      <p><strong>Campaign:</strong> ${campaign.title}</p>
                      <p><strong>Votes:</strong> ${transaction.votes}</p>
                      <p><strong>Platform commission:</strong> ${transaction.platformCommissionAmount}</p>
                    </div>
                  `,
                  text: `Voting payment processed for ${campaign.title}. Votes: ${transaction.votes}. Platform commission: ${transaction.platformCommissionAmount}.`,
                  smsMessage: `Voting payment processed for ${campaign.title}. Platform commission: ${transaction.platformCommissionAmount}.`,
                  smsEnabled: admin.notificationSmsEnabled === true,
                });
              }
            }
          }
        }
      } else if (paymentType === 'competition_vote') {
        const transaction =
          resolvedPayment.transaction ||
          (await CompetitionVoteTransaction.findOne({
            checkoutRequestId,
          }));
        if (transaction) {
          const wasAlreadyPaid = transaction.status === 'paid';
          transaction.status = paid ? 'paid' : 'failed';
          transaction.resultCode = resultCode;
          transaction.resultDesc = resultDesc;
          transaction.mpesaReceiptNumber =
            findItemValue('MpesaReceiptNumber') || '';
          if (paid) transaction.paidAt = new Date();
          await transaction.save();

          console.log('✅ Competition vote transaction updated:', {
            transactionId: transaction._id,
            status: transaction.status,
            wasAlreadyPaid,
          });

          if (paid && !wasAlreadyPaid) {
            const event = await Event.findById(transaction.eventId);
            if (event && event.eventType === 'competition') {
              const contestant = (event.competition?.contestants || []).find(
                (item) => {
                  const key = `${String(item?.fullName || '')
                    .trim()
                    .toLowerCase()}::${String(item?.category || '')
                    .trim()
                    .toLowerCase()}`;
                  return key === String(transaction.contestantKey || '');
                }
              );

              if (contestant) {
                contestant.votes = Math.max(
                  0,
                  Number(contestant.votes || 0) + Number(transaction.votes || 0)
                );
                event.markModified('competition.contestants');
                await event.save();
              }

              await notifyRecipient({
                email: transaction.voterEmail,
                phone: transaction.voterPhone,
                subject: 'Competition vote payment confirmed',
                html: `
                  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                    <h2>Vote Payment Confirmed</h2>
                    <p><strong>Competition:</strong> ${event.title}</p>
                    <p><strong>Contestant:</strong> ${contestant?.fullName || transaction.contestantName || 'Selected contestant'}</p>
                    <p><strong>Category:</strong> ${contestant?.category || transaction.contestantCategory || '-'}</p>
                    <p><strong>Votes Recorded:</strong> ${transaction.votes}</p>
                    <p><strong>Amount:</strong> ${transaction.totalAmount}</p>
                  </div>
                `,
                text: `Payment received. Your votes are recorded for ${event.title}. Contestant: ${contestant?.fullName || transaction.contestantName || 'Selected contestant'}. Votes: ${transaction.votes}. Amount: ${transaction.totalAmount}.`,
                smsMessage: `Payment received. Your votes are recorded for ${event.title}. Contestant: ${contestant?.fullName || transaction.contestantName || 'Selected contestant'}. Votes: ${transaction.votes}.`,
                smsEnabled: true,
              });
            }
          }
        }
      } else if (paymentType === 'merchandise') {
        const order =
          resolvedPayment.merchOrder ||
          (await MerchOrder.findOne({ checkoutRequestId }));
        if (order) {
          const wasAlreadyPaid = order.paymentStatus === 'paid';
          const shouldRestoreStock =
            !paid && order.paymentStatus === 'pending';
          order.paymentStatus = paid ? 'paid' : 'failed';
          order.resultCode = resultCode;
          order.resultDesc = resultDesc;
          order.mpesaReceiptNumber =
            findItemValue('MpesaReceiptNumber') || '';
          if (paid) {
            order.paidAt = new Date();
            order.paymentReference =
              order.paymentReference || checkoutRequestId;
          }
          await order.save();

          if (shouldRestoreStock) {
            const product = await MerchProduct.findByIdAndUpdate(
              order.productId,
              { $inc: { stock: order.quantity } },
              { new: true }
            );
            if (product?.status === 'out_of_stock' && product.stock > 0) {
              product.status = 'active';
              await product.save();
            }
          }

          console.log('✅ Merchandise order payment updated:', {
            orderId: order._id,
            paymentStatus: order.paymentStatus,
            wasAlreadyPaid,
            stockRestored: shouldRestoreStock,
          });
        }
      } else {
        const order =
          resolvedPayment.order ||
          (await TicketOrder.findOne({ checkoutRequestId }));
        if (order) {
          const storedCheckoutStatus =
            getCheckoutStatus(checkoutRequestId) || {};
          const fallbackEmail = String(
            storedCheckoutStatus.customerEmail || order.customerEmail || ''
          ).trim();
          const fallbackPhone = String(
            storedCheckoutStatus.phone ||
              storedCheckoutStatus.phoneNumber ||
              order.customerPhone ||
              ''
          ).trim();

          if (!order.customerEmail && fallbackEmail) {
            order.customerEmail = fallbackEmail;
          }
          if (!order.customerPhone && fallbackPhone) {
            order.customerPhone = fallbackPhone;
          }

          console.log('📦 Found ticket order:', {
            orderId: order._id,
            status: order.status,
            ticketCode: order.ticketCode,
            entryCode: order.entryCode,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            fallbackEmail,
            fallbackPhone,
          });

          const wasAlreadyPaid = order.status === 'paid';
          order.status = paid ? 'paid' : 'failed';
          order.resultCode = resultCode;
          order.resultDesc = resultDesc;
          order.mpesaReceiptNumber = findItemValue('MpesaReceiptNumber') || '';
          if (paid) order.paidAt = new Date();

          // Only assign ticket identity if not already set
          if (paid && (!order.ticketCode || order.ticketCode === '')) {
            await assignTicketIdentity(order);
          }

          await order.save();

          console.log('✅ Ticket order updated:', {
            orderId: order._id,
            status: order.status,
            ticketCode: order.ticketCode,
            wasAlreadyPaid,
          });

          if (paid && !wasAlreadyPaid) {
            const event = await Event.findById(order.eventId);
            if (event) {
              // Ensure ticket identity exists
              if (!order.ticketCode || order.ticketCode === '') {
                await assignTicketIdentity(order);
                await order.save();
              }

              const ticketRecipientEmail = String(
                order.customerEmail || fallbackEmail || ''
              ).trim();
              const ticketRecipientPhone = String(
                order.customerPhone || fallbackPhone || ''
              ).trim();

              if (!ticketRecipientEmail) {
                console.warn('⚠️ Missing customer email for ticket delivery', {
                  checkoutRequestId,
                  orderId: order._id,
                  storedCheckoutStatus,
                });
              }

              const tier = event.tiers.find(
                (item) => item.name === order.tierName
              );
              if (tier) {
                tier.remainingSlots = Math.max(
                  0,
                  Number(tier.remainingSlots || 0) - Number(order.quantity || 0)
                );
                await event.save();
              }

              const organizer = event.organizerId
                ? await Organizer.findById(event.organizerId).lean()
                : null;

              const qrPayload = buildTicketQrPayload({
                ticketCode: order.ticketCode,
                entryCode: order.entryCode,
              });

              const ticketPdf = await buildTicketPdfBuffer({
                order,
                event,
                customerEmail: ticketRecipientEmail,
              });

              console.log('📧 PRE-EMAIL TICKET PAYLOAD:', {
                orderId: order._id,
                checkoutRequestId: order.checkoutRequestId,
                status: order.status,
                eventId: order.eventId,
                eventTitle: order.eventTitle,
                customerEmail: ticketRecipientEmail,
                customerPhone: ticketRecipientPhone,
                tierName: order.tierName,
                quantity: order.quantity,
                totalAmount: order.totalAmount,
                ticketCode: order.ticketCode,
                entryCode: order.entryCode,
                mpesaReceiptNumber: order.mpesaReceiptNumber,
                hasPdf: Boolean(ticketPdf),
                qrPayload,
              });

              console.log('📧 Sending ticket confirmation to:', {
                email: ticketRecipientEmail,
                phone: ticketRecipientPhone,
                ticketCode: order.ticketCode,
                entryCode: order.entryCode,
              });

              // Send customer notification
              await notifyRecipient({
                email: ticketRecipientEmail,
                phone: ticketRecipientPhone,
                subject: `Ticket Confirmed: ${event.title}`,
                html: `
                  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:600px;margin:0 auto;padding:20px;">
                    <h2 style="color:#2563eb;">🎫 Ticket Purchase Confirmed</h2>
                    <p>Thank you for your purchase! Your ticket has been confirmed.</p>
                    <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;">
                      <p><strong>Event:</strong> ${event.title}</p>
                      <p><strong>Tier:</strong> ${order.tierName}</p>
                      <p><strong>Quantity:</strong> ${order.quantity}</p>
                      <p><strong>Amount:</strong> ${order.totalAmount}</p>
                      <p><strong>Ticket Code:</strong> ${order.ticketCode}</p>
                      <p><strong>Entry Code:</strong> ${order.entryCode}</p>
                    </div>
                    <p><strong>QR Data:</strong> ${qrPayload}</p>
                    <p style="font-size:14px;color:#64748b;">Your PDF ticket is attached to this email. Please present it at the venue.</p>
                  </div>
                `,
                text: `Ticket purchase confirmed for ${event.title}. Tier: ${order.tierName}. Quantity: ${order.quantity}. Amount: ${order.totalAmount}. Ticket code: ${order.ticketCode}. Entry code: ${order.entryCode}. QR: ${qrPayload}.`,
                smsMessage: `Ticket confirmed for ${event.title}. Code: ${order.entryCode}. Ticket: ${order.ticketCode}. Show both at entry.`,
                smsEnabled: true,
                attachments: [
                  {
                    filename: `${String(order.ticketCode || 'ticket').toLowerCase()}.pdf`,
                    content: ticketPdf,
                    contentType: 'application/pdf',
                  },
                ],
              });

              order.ticketPdfSentAt = new Date();
              await order.save();

              // Send organizer notification
              if (organizer?.email) {
                await notifyRecipient({
                  email: organizer.email,
                  phone: organizer.phone,
                  subject: `Ticket Sold: ${event.title}`,
                  html: `
                    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                      <h2>Ticket Sold</h2>
                      <p><strong>Event:</strong> ${event.title}</p>
                      <p><strong>Tier:</strong> ${order.tierName}</p>
                      <p><strong>Quantity:</strong> ${order.quantity}</p>
                      <p><strong>Ticket code:</strong> ${order.ticketCode}</p>
                      <p><strong>Entry code:</strong> ${order.entryCode}</p>
                    </div>
                  `,
                  text: `A ticket purchase was completed for ${event.title}. Ticket code: ${order.ticketCode}. Entry code: ${order.entryCode}.`,
                  smsMessage: `Ticket sold for ${event.title}. Ticket ${order.ticketCode}, entry code ${order.entryCode}.`,
                  smsEnabled: organizer.notificationSmsEnabled !== false,
                });
              }
            }
          }
        } else {
          console.log(
            '⚠️ No ticket order found for checkoutRequestId:',
            checkoutRequestId
          );
        }
      }

      setCheckoutStatus(checkoutRequestId, {
        status: paid ? 'paid' : 'failed',
        resultCode,
        resultDesc,
        mpesaReceiptNumber: findItemValue('MpesaReceiptNumber'),
        transactionDate: findItemValue('TransactionDate'),
        paidAmount: findItemValue('Amount'),
        phoneNumber: findItemValue('PhoneNumber'),
        callbackReceivedAt: new Date().toISOString(),
      });
    } else {
      console.log('⚠️ No checkoutRequestId in callback payload');
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('❌ MPESA Callback error:', error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
