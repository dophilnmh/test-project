import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import VotingCampaign from '@/app/models/VotingCampaign';
import Event from '@/app/models/Event';
import Organizer from '@/app/models/Organizer';
import User from '@/app/models/User';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';

function toSafeNominees(nominees) {
  return (Array.isArray(nominees) ? nominees : [])
    .map((item) => ({
      name: String(item?.name || '').trim(),
      category: String(item?.category || 'General').trim() || 'General',
      tagline: String(item?.tagline || '').trim(),
      imageUrl: String(item?.imageUrl || '').trim(),
    }))
    .filter((item) => item.name.length > 0);
}

function toSafePackages(packages) {
  return (Array.isArray(packages) ? packages : [])
    .map((item) => ({
      name: String(item?.name || '').trim(),
      votes: Math.max(1, Number(item?.votes || 1)),
      price: Math.max(0, Number(item?.price || 0)),
    }))
    .filter((item) => item.name.length > 0);
}

function normalizePublicVoteDisplay(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return ['count', 'percent', 'hide'].includes(normalized)
    ? normalized
    : 'count';
}

export async function GET(req) {
  try {
    const scope = req.nextUrl.searchParams.get('scope');
    const session = scope ? await auth() : null;

    if (scope === 'admin') {
      const role = session?.user?.role;
      if (role !== 'admin' && role !== 'superadmin') {
        return NextResponse.json(
          { success: false, message: 'Only admins can access all campaigns' },
          { status: 403 }
        );
      }
    }

    if (scope === 'organizer') {
      if (!session?.user) {
        return NextResponse.json(
          { success: false, message: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    await connect();

    if (scope === 'organizer') {
      const organizer = await Organizer.findOne({
        email: String(session.user.email).toLowerCase(),
      }).lean();

      if (!organizer) {
        return NextResponse.json(
          { success: false, message: 'Organizer profile not found' },
          { status: 404 }
        );
      }

      const query = { organizerId: organizer._id };
      const eventId = String(
        req.nextUrl.searchParams.get('eventId') || ''
      ).trim();
      if (eventId) {
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
          return NextResponse.json(
            { success: false, message: 'Invalid event id' },
            { status: 400 }
          );
        }
        query.eventId = eventId;
      }

      const campaigns = await VotingCampaign.find(query)
        .sort({ endDateTime: -1 })
        .lean();

      return NextResponse.json({ success: true, campaigns });
    }

    const campaigns = await VotingCampaign.find(
      scope === 'admin' ? {} : { status: { $in: ['live', 'ended'] } }
    )
      .sort({ endDateTime: -1 })
      .lean();

    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load voting campaigns',
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (!['admin', 'superadmin', 'organizer'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only organizers and admins can create campaigns',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      eventId,
      description,
      category,
      bannerUrl,
      startDateTime,
      endDateTime,
      status,
      resultVisibility,
      publicVoteDisplay,
      nominees,
      contestants,
      votingPackages,
      commissionPercent,
    } = body || {};

    if (!title || !description || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { success: false, message: 'Missing required campaign fields' },
        { status: 400 }
      );
    }

    const contestantList = toSafeNominees(contestants || nominees).map(
      (contestant) => ({
        ...contestant,
        _id: new mongoose.Types.ObjectId(),
      })
    );
    const packageList = toSafePackages(votingPackages);
    if (contestantList.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Add at least two contestants' },
        { status: 400 }
      );
    }

    await connect();

    const organizer = await Organizer.findOne({
      email: String(session.user.email).toLowerCase(),
    }).lean();

    const selectedEventId = String(eventId || '').trim();
    if (role === 'organizer' && !selectedEventId) {
      return NextResponse.json(
        { success: false, message: 'Select an event for this poll.' },
        { status: 400 }
      );
    }

    let linkedEvent = null;
    if (selectedEventId) {
      if (!mongoose.Types.ObjectId.isValid(selectedEventId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid event id' },
          { status: 400 }
        );
      }
      if (!organizer) {
        return NextResponse.json(
          { success: false, message: 'Organizer account not found.' },
          { status: 404 }
        );
      }
      linkedEvent = await Event.findOne({
        _id: selectedEventId,
        organizerId: organizer._id,
        status: 'approved',
      })
        .select('_id')
        .lean();
      if (!linkedEvent) {
        return NextResponse.json(
          { success: false, message: 'Selected event was not found.' },
          { status: 404 }
        );
      }
    }

    const allowedStatuses = ['draft', 'pending', 'live', 'ended', 'archived'];
    const requestedStatus = String(status || '')
      .trim()
      .toLowerCase();
    const nextStatus =
      role === 'organizer'
        ? 'pending'
        : allowedStatuses.includes(requestedStatus)
          ? requestedStatus
          : 'draft';
    const normalizedCommission = Number.isFinite(Number(commissionPercent))
      ? Number(commissionPercent)
      : 20;
    const safeCommission = Math.min(
      99,
      Math.max(1, Number(normalizedCommission) || 20)
    );
    const approvalStatus =
      nextStatus === 'live'
        ? 'approved'
        : nextStatus === 'archived'
          ? 'rejected'
          : 'pending';

    const created = await VotingCampaign.create({
      eventId: linkedEvent?._id || null,
      title: String(title).trim(),
      description: String(description).trim(),
      category: String(category || 'General').trim(),
      bannerUrl: String(bannerUrl || '').trim(),
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime),
      status: nextStatus,
      approvalStatus,
      commissionPercent: safeCommission,
      organizerEarningsPercent: Math.max(0, 100 - safeCommission),
      resultVisibility: resultVisibility === 'after_end' ? 'after_end' : 'live',
      publicVoteDisplay: normalizePublicVoteDisplay(publicVoteDisplay),
      contestants: contestantList,
      nominees: contestantList,
      votingPackages: packageList,
      organizerId: organizer?._id || null,
      organizerName: organizer?.organizationName || '',
      createdByEmail: session.user.email || '',
    });

    const superadmins = await User.find({ role: 'superadmin' })
      .select(
        'email notificationPhone phone notificationEmailEnabled notificationSmsEnabled'
      )
      .lean();

    const notificationJobs = [];
    for (const admin of superadmins) {
      if (admin.email && admin.notificationEmailEnabled !== false) {
        notificationJobs.push(
          sendMailSafe({
            to: admin.email,
            subject: 'New voting campaign pending approval',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                <h2>New Voting Campaign</h2>
                <p><strong>Title:</strong> ${created.title}</p>
                <p><strong>Organizer:</strong> ${created.organizerName || 'Admin'}</p>
                <p><strong>Contestants:</strong> ${contestantList.length}</p>
                <p><strong>Packages:</strong> ${packageList.length}</p>
                <p>Approval requires commission setup before publishing.</p>
              </div>
            `,
            text: `New voting campaign pending approval. Title: ${created.title}. Organizer: ${created.organizerName || 'Admin'}. Contestants: ${contestantList.length}. Packages: ${packageList.length}.`,
          })
        );
      }

      const smsPhone = admin.notificationPhone || admin.phone;
      if (smsPhone && admin.notificationSmsEnabled) {
        notificationJobs.push(
          sendSmsSafe({
            phone: smsPhone,
            message: `New voting campaign pending approval: ${created.title}. Set commission before publishing.`,
          })
        );
      }
    }

    await Promise.allSettled(notificationJobs);

    return NextResponse.json({
      success: true,
      message:
        role === 'organizer'
          ? 'Voting campaign submitted for approval'
          : 'Voting campaign created successfully',
      campaign: created,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to create campaign' },
      { status: 500 }
    );
  }
}
