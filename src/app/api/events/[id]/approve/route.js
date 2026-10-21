import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import Organizer from '@/app/models/Organizer';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';

export async function POST(req, context) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    const params = await context?.params;
    const pathId = params?.id;
    const urlId = req.url.split('/').filter(Boolean).slice(-2, -1)[0];
    const eventId = pathId || urlId;

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'Event id is required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const action = body?.action === 'reject' ? 'reject' : 'approve';
    const rejectionReason = String(body?.rejectionReason || '').trim();
    const commercialTerms = {
      ticketCommissionPercent: Number(body?.ticketCommissionPercent),
      merchandiseCommissionPercent: Number(body?.merchandiseCommissionPercent),
      votingCommissionPercent: Number(body?.votingCommissionPercent),
    };

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { success: false, message: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    if (
      action === 'approve' &&
      Object.values(commercialTerms).some(
        (value) => !Number.isFinite(value) || value < 0 || value > 100
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Ticket, merchandise, and voting commissions must each be between 0 and 100%.',
        },
        { status: 400 }
      );
    }

    await connect();

    const existing = await Event.findById(eventId).lean();

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          message: `Event is already ${existing.status} and cannot be reviewed again`,
        },
        { status: 400 }
      );
    }

    if (
      action === 'approve' &&
      new Date(existing.startDateTime) <= new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Cannot approve an event with a past start date',
        },
        { status: 400 }
      );
    }

    let linkedTicketEvent = null;
    if (action === 'approve' && existing.eventType === 'competition') {
      const ticketEventId = String(
        body?.ticketEventId || existing.competition?.ticketEventId || ''
      ).trim();
      if (!ticketEventId) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Select an approved ticketing event before approving this competition.',
          },
          { status: 400 }
        );
      }
      if (!/^[a-f\d]{24}$/i.test(ticketEventId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid ticketing event id.' },
          { status: 400 }
        );
      }
      linkedTicketEvent = await Event.findOne({
        _id: ticketEventId,
        organizerId: existing.organizerId,
        status: 'approved',
        $or: [{ eventType: 'ticketing' }, { eventType: { $exists: false } }],
      })
        .select('_id')
        .lean();
      if (!linkedTicketEvent) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Choose an approved ticketing event owned by this competition organizer.',
          },
          { status: 400 }
        );
      }
    }

    const updated = await Event.findByIdAndUpdate(
      eventId,
      {
        status: action === 'approve' ? 'approved' : 'rejected',
        publishedAt: action === 'approve' ? new Date() : null,
        rejectionReason: action === 'reject' ? rejectionReason : '',
        ...(action === 'approve' ? { commercialTerms } : {}),
        ...(linkedTicketEvent
          ? { 'competition.ticketEventId': linkedTicketEvent._id }
          : {}),
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    const organizer = await Organizer.findById(updated.organizerId).lean();
    const notificationJobs = [];

    if (organizer?.email) {
      notificationJobs.push(
        sendMailSafe({
          to: organizer.email,
          subject:
            action === 'approve'
              ? 'Your event has been approved'
              : 'Your event was rejected',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
              <h2>Event ${action === 'approve' ? 'Approved' : 'Rejected'}</h2>
              <p><strong>Event:</strong> ${updated.title}</p>
              <p><strong>Status:</strong> ${updated.status}</p>
              ${
                action === 'reject' && rejectionReason
                  ? `<p><strong>Reason:</strong> ${rejectionReason}</p>`
                  : ''
              }
              <p>${
                action === 'approve'
                  ? 'Your event is now live on the platform.'
                  : 'Please review the requirements and resubmit.'
              }</p>
            </div>
          `,
          text: `Your event ${updated.title} has been ${action === 'approve' ? 'approved' : 'rejected'}. Status: ${updated.status}.${action === 'reject' && rejectionReason ? ` Reason: ${rejectionReason}.` : ''}`,
        })
      );
    }

    if (organizer?.phone && organizer.notificationSmsEnabled) {
      notificationJobs.push(
        sendSmsSafe({
          phone: organizer.phone,
          message: `Your event "${updated.title}" has been ${action === 'approve' ? 'approved' : 'rejected'} on NimblyPolls.${action === 'reject' && rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        })
      );
    }

    await Promise.allSettled(notificationJobs);

    return NextResponse.json({
      success: true,
      message:
        action === 'approve'
          ? 'Event approved and published'
          : 'Event rejected',
      event: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update event status',
      },
      { status: 500 }
    );
  }
}
