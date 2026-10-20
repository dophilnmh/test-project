import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import VotingCampaign from '@/app/models/VotingCampaign';

function getCampaignContestants(campaign) {
  return Array.isArray(campaign.contestants) && campaign.contestants.length
    ? campaign.contestants
    : campaign.nominees || [];
}

function getCategories(contestants) {
  return Array.from(
    new Set(
      contestants
        .map((item) => String(item?.category || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export async function GET(_, { params }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid poll link.' },
        { status: 400 }
      );
    }

    await connect();
    const campaign = await VotingCampaign.findById(id).lean();
    if (!campaign || !['pending', 'live'].includes(campaign.status)) {
      return NextResponse.json(
        { success: false, message: 'This poll is not accepting registrations.' },
        { status: 404 }
      );
    }

    const contestants = getCampaignContestants(campaign);
    return NextResponse.json({
      success: true,
      campaign: {
        _id: String(campaign._id),
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        categories: getCategories(contestants),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load this poll.' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid poll link.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const category = String(body?.category || '').trim();
    if (name.length < 2 || name.length > 80 || category.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Enter your name and select a category.' },
        { status: 400 }
      );
    }

    await connect();
    const campaign = await VotingCampaign.findById(id);
    if (!campaign || !['pending', 'live'].includes(campaign.status)) {
      return NextResponse.json(
        { success: false, message: 'This poll is not accepting registrations.' },
        { status: 404 }
      );
    }
    if (new Date(campaign.endDateTime).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, message: 'Registration for this poll has closed.' },
        { status: 409 }
      );
    }

    const contestants = getCampaignContestants(campaign);
    const categoryName = getCategories(contestants).find(
      (item) => item.toLowerCase() === category.toLowerCase()
    );
    if (!categoryName) {
      return NextResponse.json(
        { success: false, message: 'Select one of this poll’s available categories.' },
        { status: 400 }
      );
    }

    const duplicate = contestants.some(
      (item) =>
        String(item?.name || '').trim().toLowerCase() === name.toLowerCase() &&
        String(item?.category || '').trim().toLowerCase() ===
          categoryName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { success: false, message: 'That name is already registered in this category.' },
        { status: 409 }
      );
    }

    const nextContestants = contestants.map((item) =>
      typeof item?.toObject === 'function' ? item.toObject() : item
    );
    nextContestants.push({
      _id: new mongoose.Types.ObjectId(),
      name,
      category: categoryName,
      tagline: '',
      imageUrl: '',
      voteCount: 0,
    });
    campaign.contestants = nextContestants;
    campaign.nominees = nextContestants;
    await campaign.save();

    return NextResponse.json({
      success: true,
      message: 'Your poll registration has been submitted.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to submit registration.' },
      { status: 500 }
    );
  }
}