import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import VotingCampaign from '@/app/models/VotingCampaign';
import VotingBallot from '@/app/models/VotingBallot';
import Organizer from '@/app/models/Organizer';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';

function normalizePublicVoteDisplay(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return ['count', 'percent', 'hide'].includes(normalized)
    ? normalized
    : 'count';
}

function toSafeNominees(nominees) {
  return (Array.isArray(nominees) ? nominees : [])
    .map((item) => ({
      ...(mongoose.Types.ObjectId.isValid(String(item?._id || ''))
        ? { _id: String(item._id) }
        : {}),
      name: String(item?.name || '').trim(),
      category: String(item?.category || 'General').trim() || 'General',
      tagline: String(item?.tagline || '').trim(),
      imageUrl: String(item?.imageUrl || '').trim(),
    }))
    .filter((item) => item.name.length > 0);
}

export async function GET(_, { params }) {
  try {
    await connect();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid campaign id' },
        { status: 400 }
      );
    }

    const campaign = await VotingCampaign.findById(id).lean();
    if (!campaign) {
      return NextResponse.json(
        { success: false, message: 'Campaign not found' },
        { status: 404 }
      );
    }

    const session = await auth();
    let hasVoted = false;

    const voterUserId =
      _?.headers?.get?.('x-voter-device-id') ||
      session?.user?.email ||
      (await cookies()).get('nimblypoll_voter_id')?.value;

    if (voterUserId) {
      const ballot = await VotingBallot.findOne({
        campaignId: campaign._id,
        voterUserId,
      }).lean();
      hasVoted = Boolean(ballot);
    }

    let hasVotedInCategory = false;
    if (voterUserId && campaign.category) {
      const categoryCampaigns = await VotingCampaign.find({
        category: campaign.category,
      })
        .select('_id')
        .lean();
      hasVotedInCategory = Boolean(
        await VotingBallot.exists({
          campaignId: { $in: categoryCampaigns.map((item) => item._id) },
          voterUserId,
        })
      );
    }

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        voteDisplayMode:
          String(campaign.voteDisplayMode || '').trim() === 'real_plus_dummy'
            ? 'real_plus_dummy'
            : 'real',
        publicVoteDisplay:
          String(campaign.publicVoteDisplay || '').trim() === 'percent'
            ? 'percent'
            : String(campaign.publicVoteDisplay || '').trim() === 'hide'
              ? 'hide'
              : 'count',
      },
      hasVoted,
      hasVotedInCategory,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load campaign' },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isOrganizer = role === 'organizer';
    if (!isAdmin && !isOrganizer) {
      return NextResponse.json(
        { success: false, message: 'You cannot update this campaign' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid campaign id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    if (isOrganizer && body?.ticketEventId !== undefined) {
      return NextResponse.json(
        { success: false, message: 'Only admins can link polls to ticket events.' },
        { status: 403 }
      );
    }
    const allowedStatus = ['draft', 'live', 'ended', 'archived', 'pending'];
    const nextStatus = isOrganizer
      ? 'pending'
      : String(body?.status || '').trim();
    const commissionPercent = Number(body?.commissionPercent);
    const publicVoteDisplay = normalizePublicVoteDisplay(
      body?.publicVoteDisplay
    );

    if (!isOrganizer && !allowedStatus.includes(nextStatus)) {
      return NextResponse.json(
        { success: false, message: 'Unsupported status' },
        { status: 400 }
      );
    }

    if (nextStatus === 'live') {
      if (
        !Number.isFinite(commissionPercent) ||
        commissionPercent <= 0 ||
        commissionPercent >= 100
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Commission percent must be between 1 and 99 before approving',
          },
          { status: 400 }
        );
      }
    }

    await connect();

    const previousCampaign = await VotingCampaign.findById(id).lean();
    if (!previousCampaign) {
      return NextResponse.json(
        { success: false, message: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (isOrganizer) {
      const organizer = await Organizer.findOne({
        email: String(session.user.email || '')
          .trim()
          .toLowerCase(),
      })
        .select('_id')
        .lean();
      if (
        !organizer ||
        String(previousCampaign.organizerId || '') !== String(organizer._id)
      ) {
        return NextResponse.json(
          { success: false, message: 'You can only edit your own polls.' },
          { status: 403 }
        );
      }
    }

    const requestedTicketEventId = String(body?.ticketEventId || '').trim();
    const ticketEventId = requestedTicketEventId || String(previousCampaign.eventId || '');
    if (nextStatus === 'live' && !ticketEventId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Select an approved ticket event before approving this poll.',
        },
        { status: 400 }
      );
    }
    if (requestedTicketEventId || nextStatus === 'live') {
      if (!mongoose.Types.ObjectId.isValid(ticketEventId)) {
        return NextResponse.json(
          { success: false, message: 'Select a valid ticketing event.' },
          { status: 400 }
        );
      }
      const linkedTicketEvent = await Event.findOne({
        _id: ticketEventId,
        status: 'approved',
        ...(previousCampaign.organizerId
          ? { organizerId: previousCampaign.organizerId }
          : {}),
        $or: [{ eventType: 'ticketing' }, { eventType: { $exists: false } }],
      })
        .select('_id')
        .lean();
      if (!linkedTicketEvent) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Choose an approved ticketing event owned by this poll organizer.',
          },
          { status: 400 }
        );
      }
    }

    const updateData = {
      status: nextStatus,
      approvalStatus:
        nextStatus === 'live'
          ? 'approved'
          : nextStatus === 'archived'
            ? 'rejected'
            : 'pending',
      commissionPercent: Number.isFinite(commissionPercent)
        ? commissionPercent
        : undefined,
      publicVoteDisplay,
      organizerEarningsPercent: Number.isFinite(commissionPercent)
        ? Math.max(0, 100 - commissionPercent)
        : undefined,
      publishedAt: nextStatus === 'live' ? new Date() : null,
    };
    if (requestedTicketEventId) {
      updateData.eventId = requestedTicketEventId;
    } else if (nextStatus === 'live') {
      updateData.eventId = ticketEventId;
    }

    if (body?.title !== undefined) updateData.title = String(body.title).trim();
    if (body?.description !== undefined) {
      updateData.description = String(body.description).trim();
    }
    if (body?.category !== undefined)
      updateData.category = String(body.category).trim();
    if (body?.bannerUrl !== undefined)
      updateData.bannerUrl = String(body.bannerUrl).trim();
    if (body?.resultVisibility !== undefined) {
      updateData.resultVisibility =
        body.resultVisibility === 'after_end' ? 'after_end' : 'live';
    }
    if (body?.startDateTime !== undefined)
      updateData.startDateTime = new Date(body.startDateTime);
    if (body?.endDateTime !== undefined)
      updateData.endDateTime = new Date(body.endDateTime);
    if (body?.nominees !== undefined || body?.contestants !== undefined) {
      const nominees = toSafeNominees(body.contestants || body.nominees);
      if (nominees.length < 2) {
        return NextResponse.json(
          { success: false, message: 'Add at least two contestants' },
          { status: 400 }
        );
      }
      const existingNominees = previousCampaign.contestants?.length
        ? previousCampaign.contestants
        : previousCampaign.nominees || [];
      const nomineesWithIds = nominees.map((nominee) => {
        const existing = existingNominees.find(
          (item) => String(item._id) === String(nominee._id || '')
        );
        return {
          ...nominee,
          _id: existing?._id || new mongoose.Types.ObjectId(),
        };
      });
      updateData.nominees = nomineesWithIds;
      updateData.contestants = nomineesWithIds;
    }
    if (isOrganizer) {
      if (
        !body?.title ||
        !body?.description ||
        !body?.startDateTime ||
        !body?.endDateTime
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Title, description, and poll dates are required.',
          },
          { status: 400 }
        );
      }
      updateData.approvalStatus = 'pending';
      updateData.publishedAt = null;
    }

    const campaign = await VotingCampaign.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean();

    const organizer = campaign.organizerId
      ? await Organizer.findById(campaign.organizerId).lean()
      : null;

    const notificationJobs = [];
    if (organizer?.email) {
      const closedNow =
        nextStatus === 'ended' && previousCampaign.status !== 'ended';
      notificationJobs.push(
        sendMailSafe({
          to: organizer.email,
          subject:
            nextStatus === 'live'
              ? 'Your voting campaign has been approved'
              : closedNow
                ? 'Your voting campaign has been closed'
                : 'Your voting campaign status updated',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
              <h2>Voting Campaign ${nextStatus === 'live' ? 'Approved' : closedNow ? 'Closed' : 'Updated'}</h2>
              <p><strong>Title:</strong> ${campaign.title}</p>
              <p><strong>Status:</strong> ${campaign.status}</p>
              <p><strong>Commission:</strong> ${Number(campaign.commissionPercent || commissionPercent || 0)}%</p>
              <p>${nextStatus === 'live' ? 'You can now add contestants, configure packages, and publish the event from your organizer dashboard.' : closedNow ? 'Voting has now been closed for the public. You can review final standings and payout reports from your dashboard.' : 'Please review the latest campaign status.'}</p>
            </div>
          `,
          text: `Voting campaign ${campaign.title} updated to ${campaign.status}. Commission: ${Number(campaign.commissionPercent || commissionPercent || 0)}%.${closedNow ? ` Total votes: ${Number(campaign.totalVotes || 0)}.` : ''}`,
        })
      );
    }

    if (organizer?.phone && organizer.notificationSmsEnabled) {
      const closedNow =
        nextStatus === 'ended' && previousCampaign.status !== 'ended';
      notificationJobs.push(
        sendSmsSafe({
          phone: organizer.phone,
          message: closedNow
            ? `Voting is now closed for "${campaign.title}". Final votes: ${Number(campaign.totalVotes || 0)}.`
            : `Your voting campaign "${campaign.title}" is now ${campaign.status}. Commission: ${Number(campaign.commissionPercent || commissionPercent || 0)}%.`,
        })
      );
    }

    await Promise.allSettled(notificationJobs);

    return NextResponse.json({
      success: true,
      message:
        nextStatus === 'live'
          ? 'Campaign approved and published'
          : `Campaign moved to ${nextStatus}`,
      campaign,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update campaign' },
      { status: 500 }
    );
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    const isAdmin = ['admin', 'superadmin'].includes(role);
    const isOrganizer = role === 'organizer';
    if (!isAdmin && !isOrganizer) {
      return NextResponse.json(
        { success: false, message: 'You cannot delete this poll' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid poll id' },
        { status: 400 }
      );
    }

    await connect();
    const existing = await VotingCampaign.findById(id).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Poll not found' },
        { status: 404 }
      );
    }
    if (isOrganizer) {
      const organizer = await Organizer.findOne({
        email: String(session.user.email || '')
          .trim()
          .toLowerCase(),
      })
        .select('_id')
        .lean();
      if (
        !organizer ||
        String(existing.organizerId || '') !== String(organizer._id)
      ) {
        return NextResponse.json(
          { success: false, message: 'You can only delete your own polls.' },
          { status: 403 }
        );
      }
      if (!['draft', 'pending', 'archived'].includes(existing.status)) {
        return NextResponse.json(
          { success: false, message: 'Only unpublished polls can be deleted.' },
          { status: 409 }
        );
      }
    }
    const deleted = await VotingCampaign.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Poll not found' },
        { status: 404 }
      );
    }
    await VotingBallot.deleteMany({ campaignId: id });
    return NextResponse.json({
      success: true,
      message: 'Poll deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to delete poll' },
      { status: 500 }
    );
  }
}
