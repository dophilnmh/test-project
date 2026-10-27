import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Event from '@/app/models/Event';
import Organizer from '@/app/models/Organizer';
import CompetitionDeleteOtp from '@/app/models/CompetitionDeleteOtp';
import { parseDateTime } from '@/lib/dateTime';

function ensureSuperadmin(session) {
  return String(session?.user?.role || '').toLowerCase() === 'superadmin';
}

function hashCode(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

function parseDateValue(value) {
  return parseDateTime(value);
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

function toDetail(event) {
  return {
    _id: String(event._id),
    organizerId: String(event.organizerId || ''),
    organizerName: event.organizerName || '',
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    city: event.city,
    bannerUrl: event.bannerUrl || '',
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
    maxVotesPerTransaction: Math.max(
      1,
      Number(event?.competition?.maxVotesPerTransaction || 1000)
    ),
    contestants: (event?.competition?.contestants || []).map((item) => ({
      fullName: item.fullName,
      category: item.category,
      profileImageUrl: item.profileImageUrl || '',
      votes: Math.max(0, Number(item.votes || 0)),
    })),
    votePackages: (event?.competition?.votePackages || []).map((item) => ({
      name: item.name,
      votes: Math.max(1, Number(item.votes || 1)),
      price: Math.max(1, Number(item.price || 1)),
      isActive: item.isActive !== false,
    })),
  };
}

export async function GET(req, context) {
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

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id' },
        { status: 400 }
      );
    }

    await connect();

    const competition = await Event.findOne({
      _id: id,
      eventType: 'competition',
    }).lean();

    if (!competition) {
      return NextResponse.json(
        { success: false, message: 'Competition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      competition: toDetail(competition),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load competition',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req, context) {
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

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id' },
        { status: 400 }
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

    const updated = await Event.findOneAndUpdate(
      { _id: id, eventType: 'competition' },
      {
        $set: {
          organizerId,
          organizerName:
            organizer.organizationName || organizer.contactName || 'Organizer',
          title,
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
          competition: {
            maxVotesPerTransaction,
            publicVoteDisplay,
            contestants,
            votePackages,
          },
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Competition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Competition updated successfully',
      competition: toDetail(updated),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update competition',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
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

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const otp = String(body?.otp || '').trim();
    if (!otp) {
      return NextResponse.json(
        {
          success: false,
          message: 'OTP is required before deleting a competition',
        },
        { status: 400 }
      );
    }

    await connect();

    const email = String(session.user.email || '')
      .trim()
      .toLowerCase();
    const otpRecord = await CompetitionDeleteOtp.findOne({
      competitionId: id,
      email,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord || otpRecord.codeHash !== hashCode(otp)) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    otpRecord.usedAt = new Date();
    await otpRecord.save();

    const deleted = await Event.findOneAndDelete({
      _id: id,
      eventType: 'competition',
    }).lean();

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Competition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Competition deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to delete competition',
      },
      { status: 500 }
    );
  }
}
