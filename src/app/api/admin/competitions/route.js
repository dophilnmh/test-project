import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Event from '@/app/models/Event';
import Organizer from '@/app/models/Organizer';

function ensureSuperadmin(session) {
  return String(session?.user?.role || '').toLowerCase() === 'superadmin';
}

function parseDateValue(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeContestants(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows
    .map((item) => ({
      fullName: String(item?.fullName || '').trim(),
      category: String(item?.category || '').trim(),
      profileImageUrl: String(item?.profileImageUrl || '').trim(),
      votes: Math.max(0, Number(item?.votes || 0)),
    }))
    .filter((item) => item.fullName && item.category);
}

function normalizeVotePackages(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows
    .map((item) => ({
      name: String(item?.name || '').trim(),
      votes: Math.max(1, Math.round(Number(item?.votes || 1))),
      price: Math.max(1, Math.round(Number(item?.price || 1))),
      isActive: item?.isActive !== false,
    }))
    .filter((item) => item.name);
}

function normalizePublicVoteDisplay(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return ['count', 'percent', 'hide'].includes(normalized)
    ? normalized
    : 'count';
}

function summarizeCompetition(event) {
  const contestants = event?.competition?.contestants || [];
  const totalVotes = contestants.reduce(
    (sum, contestant) => sum + Number(contestant?.votes || 0),
    0
  );

  return {
    _id: String(event._id),
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    city: event.city,
    bannerUrl: event.bannerUrl || '',
    organizerId: String(event.organizerId || ''),
    organizerName: event.organizerName || '',
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    status: event.status,
    rejectionReason: event.rejectionReason || '',
    publicVoteDisplay:
      String(event?.competition?.publicVoteDisplay || '').trim() === 'percent'
        ? 'percent'
        : String(event?.competition?.publicVoteDisplay || '').trim() === 'hide'
          ? 'hide'
          : 'count',
    contestantsCount: contestants.length,
    totalVotes,
    votePackagesCount: (event?.competition?.votePackages || []).length,
    updatedAt: event.updatedAt,
    createdAt: event.createdAt,
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    await connect();

    const competitions = await Event.find({ eventType: 'competition' })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      competitions: competitions.map(summarizeCompetition),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load competitions',
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

    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();

    const organizerId = String(body?.organizerId || '').trim();
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const category = String(body?.category || '').trim();
    const venue = String(body?.venue || '').trim();
    const city = String(body?.city || '').trim();
    const bannerUrl = String(body?.bannerUrl || '').trim();
    const status = String(body?.status || 'approved')
      .trim()
      .toLowerCase();
    const rejectionReason = String(body?.rejectionReason || '').trim();
    const startDateTime = parseDateValue(body?.startDateTime);
    const endDateTime = parseDateValue(body?.endDateTime);
    const contestants = normalizeContestants(body?.contestants);
    const votePackages = normalizeVotePackages(body?.votePackages);
    const publicVoteDisplay = normalizePublicVoteDisplay(
      body?.publicVoteDisplay
    );
    const maxVotesPerTransaction = Math.max(
      1,
      Math.min(10000, Math.round(Number(body?.maxVotesPerTransaction || 1000)))
    );

    if (!mongoose.Types.ObjectId.isValid(organizerId)) {
      return NextResponse.json(
        { success: false, message: 'Valid organizer is required' },
        { status: 400 }
      );
    }

    if (
      !title ||
      !description ||
      !category ||
      !venue ||
      !city ||
      !startDateTime ||
      !endDateTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Organizer, title, description, category, venue, city, start and end date are required',
        },
        { status: 400 }
      );
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status value' },
        { status: 400 }
      );
    }

    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { success: false, message: 'End date must be after start date' },
        { status: 400 }
      );
    }

    if (contestants.length === 0) {
      return NextResponse.json(
        { success: false, message: 'At least one contestant is required' },
        { status: 400 }
      );
    }

    if (!votePackages.some((pkg) => pkg.isActive !== false)) {
      return NextResponse.json(
        {
          success: false,
          message: 'At least one active vote package is required',
        },
        { status: 400 }
      );
    }

    await connect();

    const organizer = await Organizer.findById(organizerId).lean();
    if (!organizer) {
      return NextResponse.json(
        { success: false, message: 'Organizer not found' },
        { status: 404 }
      );
    }

    const created = await Event.create({
      organizerId,
      organizerName:
        organizer.organizationName || organizer.contactName || 'Organizer',
      submittedByName:
        String(session.user.name || '').trim() ||
        String(session.user.email || '').trim(),
      submittedByEmail: String(session.user.email || '')
        .trim()
        .toLowerCase(),
      submittedByRole: String(session.user.role || '')
        .trim()
        .toLowerCase(),
      title,
      eventType: 'competition',
      description,
      category,
      venue,
      city,
      bannerUrl,
      startDateTime,
      endDateTime,
      status,
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      publishedAt: status === 'approved' ? new Date() : null,
      tiers: [],
      competition: {
        maxVotesPerTransaction,
        publicVoteDisplay,
        contestants,
        votePackages,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Competition created successfully',
        competitionId: String(created._id),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to create competition',
      },
      { status: 500 }
    );
  }
}
