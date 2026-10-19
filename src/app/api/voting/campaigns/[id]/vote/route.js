import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import VotingCampaign from '@/app/models/VotingCampaign';
import VotingBallot from '@/app/models/VotingBallot';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    const cookieStore = await cookies();
    const voterCookie = cookieStore.get('nimblypoll_voter_id')?.value;
    const voterDeviceId = req.headers.get('x-voter-device-id')?.trim();
    const voterUserId =
      voterDeviceId ||
      session?.user?.email ||
      voterCookie ||
      crypto.randomUUID();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid campaign id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const nomineeId = String(body?.nomineeId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(nomineeId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid nominee id' },
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

    const now = new Date();
    if (
      campaign.status !== 'live' ||
      now < campaign.startDateTime ||
      now > campaign.endDateTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Voting is currently closed for this campaign',
        },
        { status: 400 }
      );
    }

    const contestantIndex = (campaign.contestants || []).findIndex(
      (item) => String(item._id) === nomineeId
    );
    const nomineeIndex = (campaign.nominees || []).findIndex(
      (item) => String(item._id) === nomineeId
    );
    const selectedContestant =
      contestantIndex >= 0
        ? campaign.contestants[contestantIndex]
        : campaign.nominees[nomineeIndex];
    const selectedName = String(selectedContestant?.name || '').trim();

    const matchingNominee = (campaign.nominees || []).find(
      (item) =>
        String(item._id) === nomineeId ||
        (selectedName && String(item.name || '').trim() === selectedName)
    );
    const matchingContestant = (campaign.contestants || []).find(
      (item) =>
        String(item._id) === nomineeId ||
        (selectedName && String(item.name || '').trim() === selectedName)
    );

    if (!selectedContestant || !matchingNominee || !matchingContestant) {
      return NextResponse.json(
        { success: false, message: 'Selected nominee was not found' },
        { status: 404 }
      );
    }

    const existing = await VotingBallot.findOne({
      campaignId: campaign._id,
      voterUserId,
    }).lean();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'You already voted in this campaign' },
        { status: 409 }
      );
    }

    await VotingBallot.create({
      campaignId: campaign._id,
      nomineeId,
      voterUserId,
      voterName: session?.user?.name || '',
      voterRole: session?.user?.role || 'guest',
    });

    const updated = await VotingCampaign.findOneAndUpdate(
      { _id: campaign._id },
      {
        $inc: {
          totalVotes: 1,
          'nominees.$[nominee].voteCount': 1,
          'contestants.$[contestant].voteCount': 1,
        },
      },
      {
        new: true,
        arrayFilters: [
          {
            'nominee._id': {
              $in: [matchingNominee._id],
            },
          },
          {
            'contestant._id': {
              $in: [matchingContestant._id],
            },
          },
        ],
      }
    ).lean();

    const response = NextResponse.json({
      success: true,
      message: 'Vote cast successfully',
      campaign: updated,
    });
    if (!session?.user?.email && !voterCookie) {
      response.cookies.set('nimblypoll_voter_id', voterUserId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return response;
  } catch (error) {
    if (String(error?.code) === '11000') {
      return NextResponse.json(
        { success: false, message: 'You already voted in this campaign' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: error.message || 'Unable to cast vote' },
      { status: 500 }
    );
  }
}
