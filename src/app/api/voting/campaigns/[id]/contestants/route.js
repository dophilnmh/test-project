import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import VotingCampaign from '@/app/models/VotingCampaign';

function canManage(role) {
  return ['admin', 'superadmin', 'organizer'].includes(role);
}

function normalizeContestants(contestants) {
  return (Array.isArray(contestants) ? contestants : [])
    .map((item) => ({
      name: String(item?.name || '').trim(),
      tagline: String(item?.tagline || '').trim(),
      imageUrl: String(item?.imageUrl || '').trim(),
      voteCount: Math.max(0, Number(item?.voteCount || 0)),
    }))
    .filter((item) => item.name.length > 0);
}

function normalizePackages(packages) {
  return (Array.isArray(packages) ? packages : [])
    .map((item) => ({
      name: String(item?.name || '').trim(),
      votes: Math.max(1, Number(item?.votes || 1)),
      price: Math.max(0, Number(item?.price || 0)),
    }))
    .filter((item) => item.name.length > 0);
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

    if (!canManage(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
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
    const contestants = normalizeContestants(body?.contestants);
    const packages = normalizePackages(body?.votingPackages);

    if (contestants.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Add at least two contestants' },
        { status: 400 }
      );
    }

    if (packages.length < 1) {
      return NextResponse.json(
        { success: false, message: 'Add at least one voting package' },
        { status: 400 }
      );
    }

    await connect();

    const campaign = await VotingCampaign.findByIdAndUpdate(
      id,
      {
        contestants,
        nominees: contestants,
        votingPackages: packages,
      },
      { new: true }
    ).lean();

    if (!campaign) {
      return NextResponse.json(
        { success: false, message: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contestants and packages updated',
      campaign,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update campaign contestants',
      },
      { status: 500 }
    );
  }
}
