import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import VotingCampaign from '@/app/models/VotingCampaign';

function toSortedResults(campaign) {
  const contestants = Array.isArray(campaign.contestants)
    ? campaign.contestants
    : Array.isArray(campaign.nominees)
      ? campaign.nominees
      : [];
  const total = Math.max(1, Number(campaign.totalVotes || 0));

  return contestants
    .map((contestant) => {
      const votes = Number(contestant.voteCount || 0);
      return {
        _id: contestant._id,
        name: contestant.name,
        imageUrl: contestant.imageUrl,
        tagline: contestant.tagline,
        voteCount: votes,
        percent: Number(((votes / total) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);
}

export async function GET(_, { params }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid campaign id' },
        { status: 400 }
      );
    }

    await connect();

    const campaign = await VotingCampaign.findById(id).lean();
    if (!campaign) {
      return NextResponse.json(
        { success: false, message: 'Campaign not found' },
        { status: 404 }
      );
    }

    const session = await auth();
    const role = session?.user?.role;
    const isAdmin = role === 'admin' || role === 'superadmin';

    const now = new Date();
    const endedByDate = now > campaign.endDateTime;
    const campaignEnded = campaign.status === 'ended' || endedByDate;
    const publicAllowed = campaign.resultVisibility === 'live' || campaignEnded;

    if (!isAdmin && !publicAllowed) {
      return NextResponse.json(
        { success: false, message: 'Results are not public yet' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      campaign: {
        _id: campaign._id,
        title: campaign.title,
        category: campaign.category,
        status: campaign.status,
        totalVotes: campaign.totalVotes,
        endDateTime: campaign.endDateTime,
        votingPackages: campaign.votingPackages || [],
      },
      results: toSortedResults(campaign),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load results' },
      { status: 500 }
    );
  }
}
