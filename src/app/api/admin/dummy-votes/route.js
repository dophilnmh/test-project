import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Event from '@/app/models/Event';
import VotingCampaign from '@/app/models/VotingCampaign';
import DummyVoteAdjustment from '@/app/models/DummyVoteAdjustment';
import CompetitionVoteTransaction from '@/app/models/CompetitionVoteTransaction';
import VotingTransaction from '@/app/models/VotingTransaction';

function ensureSuperadmin(session) {
  if (!session?.user) {
    return NextResponse.json(
      { success: false, message: 'Authentication required' },
      { status: 401 }
    );
  }

  if (session.user.role !== 'superadmin') {
    return NextResponse.json(
      { success: false, message: 'Superadmin access required' },
      { status: 403 }
    );
  }

  return null;
}

function keyForCompetitionContestant(item) {
  return `${String(item?.fullName || '')
    .trim()
    .toLowerCase()}::${String(item?.category || '')
    .trim()
    .toLowerCase()}`;
}

function keyForCampaignContestant(item) {
  return String(item?._id || '').trim();
}

export async function GET() {
  try {
    const session = await auth();
    const authError = ensureSuperadmin(session);
    if (authError) return authError;

    await connect();

    const [
      events,
      campaigns,
      adjustments,
      competitionAmounts,
      campaignAmounts,
    ] = await Promise.all([
      Event.find({ eventType: 'competition', status: 'approved' })
        .select('title competition.contestants competition.voteDisplayMode')
        .lean(),
      VotingCampaign.find({ status: { $in: ['live', 'ended', 'archived'] } })
        .select('title contestants nominees voteDisplayMode')
        .lean(),
      DummyVoteAdjustment.find({ dummyVotes: { $gt: 0 } }).lean(),
      CompetitionVoteTransaction.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: {
              eventId: '$eventId',
              contestantKey: '$contestantKey',
            },
            amountUsed: { $sum: { $ifNull: ['$totalAmount', 0] } },
          },
        },
      ]),
      VotingTransaction.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: {
              campaignId: '$campaignId',
              contestantId: '$contestantId',
            },
            amountUsed: { $sum: { $ifNull: ['$totalAmount', 0] } },
          },
        },
      ]),
    ]);

    const adjustmentMap = new Map();
    for (const adj of adjustments) {
      const key = `${String(adj.targetType)}::${String(adj.targetId)}::${String(adj.contestantKey)}`;
      adjustmentMap.set(key, Math.max(0, Number(adj.dummyVotes || 0)));
    }

    const competitionAmountMap = new Map(
      competitionAmounts.map((item) => [
        `competition_event::${String(item?._id?.eventId || '')}::${String(item?._id?.contestantKey || '')}`,
        Math.max(0, Number(item?.amountUsed || 0)),
      ])
    );

    const campaignAmountMap = new Map(
      campaignAmounts.map((item) => [
        `campaign_vote::${String(item?._id?.campaignId || '')}::${String(item?._id?.contestantId || '')}`,
        Math.max(0, Number(item?.amountUsed || 0)),
      ])
    );

    const rows = [];

    for (const event of events) {
      const contestants = event?.competition?.contestants || [];
      const voteDisplayMode =
        String(event?.competition?.voteDisplayMode || '').trim() ===
        'real_plus_dummy'
          ? 'real_plus_dummy'
          : 'real';
      const publicVoteDisplay =
        String(event?.competition?.publicVoteDisplay || '').trim() === 'percent'
          ? 'percent'
          : String(event?.competition?.publicVoteDisplay || '').trim() ===
              'hide'
            ? 'hide'
            : 'count';
      for (const contestant of contestants) {
        const contestantKey = keyForCompetitionContestant(contestant);
        if (!contestantKey) continue;

        const realVotes = Math.max(0, Number(contestant?.votes || 0));
        const lookupKey = `competition_event::${String(event._id)}::${contestantKey}`;
        const dummyVotes = adjustmentMap.get(lookupKey) || 0;
        const displayedVotes =
          voteDisplayMode === 'real_plus_dummy'
            ? realVotes + dummyVotes
            : realVotes;

        rows.push({
          targetType: 'competition_event',
          targetId: String(event._id),
          targetTitle: String(event.title || 'Competition Event'),
          voteDisplayMode,
          publicVoteDisplay,
          contestantKey,
          contestantName: String(contestant?.fullName || 'Contestant').trim(),
          contestantCategory: String(contestant?.category || 'General').trim(),
          realVotes,
          dummyVotes,
          displayedVotes,
          amountUsed: competitionAmountMap.get(lookupKey) || 0,
        });
      }
    }

    for (const campaign of campaigns) {
      const contestants =
        Array.isArray(campaign?.contestants) && campaign.contestants.length > 0
          ? campaign.contestants
          : campaign?.nominees || [];

      const voteDisplayMode =
        String(campaign?.voteDisplayMode || '').trim() === 'real_plus_dummy'
          ? 'real_plus_dummy'
          : 'real';
      const publicVoteDisplay =
        String(campaign?.publicVoteDisplay || '').trim() === 'percent'
          ? 'percent'
          : String(campaign?.publicVoteDisplay || '').trim() === 'hide'
            ? 'hide'
            : 'count';

      for (const contestant of contestants) {
        const contestantKey = keyForCampaignContestant(contestant);
        if (!contestantKey) continue;

        const realVotes = Math.max(0, Number(contestant?.voteCount || 0));
        const lookupKey = `campaign_vote::${String(campaign._id)}::${contestantKey}`;
        const dummyVotes = adjustmentMap.get(lookupKey) || 0;
        const displayedVotes =
          voteDisplayMode === 'real_plus_dummy'
            ? realVotes + dummyVotes
            : realVotes;

        rows.push({
          targetType: 'campaign_vote',
          targetId: String(campaign._id),
          targetTitle: String(campaign.title || 'Voting Campaign'),
          voteDisplayMode,
          publicVoteDisplay,
          contestantKey,
          contestantName: String(contestant?.name || 'Contestant').trim(),
          contestantCategory: String(contestant?.tagline || '').trim(),
          realVotes,
          dummyVotes,
          displayedVotes,
          amountUsed: campaignAmountMap.get(lookupKey) || 0,
        });
      }
    }

    rows.sort((a, b) => {
      if (a.targetTitle !== b.targetTitle) {
        return a.targetTitle.localeCompare(b.targetTitle);
      }
      return b.displayedVotes - a.displayedVotes;
    });

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load dummy vote rows',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    const authError = ensureSuperadmin(session);
    if (authError) return authError;

    const body = await req.json();
    const action = String(body?.action || '').trim();
    const targetType = String(body?.targetType || '').trim();
    const targetId = String(body?.targetId || '').trim();
    const displayMode = String(body?.displayMode || '').trim();
    const publicVoteDisplay = String(body?.publicVoteDisplay || '').trim();
    const contestantKey = String(body?.contestantKey || '')
      .trim()
      .toLowerCase();
    const contestantName = String(body?.contestantName || '').trim();
    const contestantCategory = String(body?.contestantCategory || '').trim();
    const dummyVotes = Math.max(0, Math.round(Number(body?.dummyVotes || 0)));

    if (!['competition_event', 'campaign_vote'].includes(targetType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid target type' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid target id' },
        { status: 400 }
      );
    }

    await connect();

    if (action === 'set_display_mode') {
      if (!['real', 'real_plus_dummy'].includes(displayMode)) {
        return NextResponse.json(
          { success: false, message: 'Invalid display mode' },
          { status: 400 }
        );
      }

      if (targetType === 'competition_event') {
        const updated = await Event.findOneAndUpdate(
          { _id: targetId, eventType: 'competition' },
          { $set: { 'competition.voteDisplayMode': displayMode } },
          { new: true }
        ).lean();

        if (!updated) {
          return NextResponse.json(
            { success: false, message: 'Competition event not found' },
            { status: 404 }
          );
        }
      } else {
        const updated = await VotingCampaign.findByIdAndUpdate(
          targetId,
          { $set: { voteDisplayMode: displayMode } },
          { new: true }
        ).lean();

        if (!updated) {
          return NextResponse.json(
            { success: false, message: 'Voting campaign not found' },
            { status: 404 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message:
          displayMode === 'real_plus_dummy'
            ? 'Contest display set to real + dummy votes.'
            : 'Contest display set to real votes only.',
        displayMode,
      });
    }

    if (action === 'set_public_vote_display') {
      if (!['count', 'percent', 'hide'].includes(publicVoteDisplay)) {
        return NextResponse.json(
          { success: false, message: 'Invalid public vote display value' },
          { status: 400 }
        );
      }

      if (targetType === 'competition_event') {
        const updated = await Event.findOneAndUpdate(
          { _id: targetId, eventType: 'competition' },
          { $set: { 'competition.publicVoteDisplay': publicVoteDisplay } },
          { new: true }
        ).lean();

        if (!updated) {
          return NextResponse.json(
            { success: false, message: 'Competition event not found' },
            { status: 404 }
          );
        }
      } else {
        const updated = await VotingCampaign.findByIdAndUpdate(
          targetId,
          { $set: { publicVoteDisplay } },
          { new: true }
        ).lean();

        if (!updated) {
          return NextResponse.json(
            { success: false, message: 'Voting campaign not found' },
            { status: 404 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Public vote display updated successfully.',
        publicVoteDisplay,
      });
    }

    if (!contestantKey) {
      return NextResponse.json(
        { success: false, message: 'Contestant key is required' },
        { status: 400 }
      );
    }

    if (dummyVotes === 0) {
      await DummyVoteAdjustment.deleteOne({
        targetType,
        targetId,
        contestantKey,
      });

      return NextResponse.json({
        success: true,
        message: 'Dummy votes cleared for contestant.',
      });
    }

    await DummyVoteAdjustment.findOneAndUpdate(
      {
        targetType,
        targetId,
        contestantKey,
      },
      {
        $set: {
          contestantName,
          contestantCategory,
          dummyVotes,
          updatedByEmail: String(session.user.email || '').trim(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Dummy votes updated successfully.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update dummy votes',
      },
      { status: 500 }
    );
  }
}
