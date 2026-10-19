import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Organizer from '@/app/models/Organizer';
import Event from '@/app/models/Event';

function slugTierName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

function normalizeContestantKey(fullName, category) {
  return `${String(fullName || '')
    .trim()
    .toLowerCase()}::${String(category || '')
    .trim()
    .toLowerCase()}`;
}

async function getOrganizer() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  await connect();

  const organizer = await Organizer.findOne({
    email: String(session.user.email).toLowerCase(),
  }).lean();

  if (!organizer) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Organizer account not found' },
        { status: 404 }
      ),
    };
  }

  return { organizer };
}

function isEventLive(event) {
  const now = Date.now();
  const startsAt = new Date(event.startDateTime).getTime();
  const endsAt = new Date(event.endDateTime).getTime();
  return startsAt <= now && endsAt >= now;
}

export async function PATCH(req, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid event id' },
        { status: 400 }
      );
    }

    const authContext = await getOrganizer();
    if (authContext.error) return authContext.error;

    const { organizer } = authContext;
    const event = await Event.findOne({
      _id: id,
      organizerId: organizer._id,
    });

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          message: 'Only approved events can be updated from live manager.',
        },
        { status: 409 }
      );
    }

    if (!isEventLive(event)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Live updates are allowed only while the event is ongoing.',
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const action = String(body?.action || '')
      .trim()
      .toLowerCase();

    if (action === 'add_contestant') {
      if (event.eventType !== 'competition') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Contestant updates are available for competition events only.',
          },
          { status: 400 }
        );
      }

      const fullName = String(body?.fullName || '').trim();
      const category = String(body?.category || '').trim();
      const profileImageUrl = String(body?.profileImageUrl || '').trim();

      if (!fullName || !category) {
        return NextResponse.json(
          {
            success: false,
            message: 'Contestant name and category are required.',
          },
          { status: 400 }
        );
      }

      const availableCategories = new Set(
        [
          ...(event.competition?.categories || []),
          ...(event.competition?.contestants || []).map(
            (contestant) => contestant.category
          ),
        ].map((item) =>
          String(item || '')
            .trim()
            .toLowerCase()
        )
      );
      if (!availableCategories.has(category.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            message: 'Select one of this event’s available categories.',
          },
          { status: 400 }
        );
      }

      const key = normalizeContestantKey(fullName, category);
      const exists = (event.competition?.contestants || []).some(
        (item) => normalizeContestantKey(item?.fullName, item?.category) === key
      );

      if (exists) {
        return NextResponse.json(
          {
            success: false,
            message: 'Contestant already exists for this category.',
          },
          { status: 409 }
        );
      }

      event.competition = event.competition || {};
      event.competition.contestants = [
        ...(event.competition.contestants || []),
        {
          fullName,
          category,
          profileImageUrl,
          votes: 0,
        },
      ];
      event.markModified('competition.contestants');
      await event.save();

      return NextResponse.json({
        success: true,
        message: 'Contestant added successfully.',
        event,
      });
    }

    if (action === 'delete_contestant') {
      if (event.eventType !== 'competition') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Contestant updates are available for competition events only.',
          },
          { status: 400 }
        );
      }

      const contestantKey = String(body?.contestantKey || '')
        .trim()
        .toLowerCase();
      if (!contestantKey) {
        return NextResponse.json(
          { success: false, message: 'Contestant key is required.' },
          { status: 400 }
        );
      }

      const contestants = event.competition?.contestants || [];
      const next = contestants.filter(
        (item) =>
          normalizeContestantKey(item?.fullName, item?.category) !==
          contestantKey
      );

      if (next.length === contestants.length) {
        return NextResponse.json(
          { success: false, message: 'Contestant not found.' },
          { status: 404 }
        );
      }

      if (next.length < 1) {
        return NextResponse.json(
          {
            success: false,
            message: 'At least one contestant must remain in the competition.',
          },
          { status: 400 }
        );
      }

      event.competition = event.competition || {};
      event.competition.contestants = next;
      event.markModified('competition.contestants');
      await event.save();

      return NextResponse.json({
        success: true,
        message: 'Contestant removed successfully.',
        event,
      });
    }

    if (action === 'add_ticket') {
      if (event.eventType !== 'ticketing') {
        return NextResponse.json(
          {
            success: false,
            message: 'Ticket updates are available for ticketing events only.',
          },
          { status: 400 }
        );
      }

      const name = slugTierName(body?.name);
      const price = Math.max(0, Number(body?.price || 0));
      const totalSlots = Math.max(0, Number(body?.totalSlots || 0));

      if (!name) {
        return NextResponse.json(
          { success: false, message: 'Ticket name is required.' },
          { status: 400 }
        );
      }

      const exists = (event.tiers || []).some(
        (tier) =>
          String(tier?.name || '')
            .trim()
            .toLowerCase() === name
      );
      if (exists) {
        return NextResponse.json(
          {
            success: false,
            message: 'A ticket with this name already exists.',
          },
          { status: 409 }
        );
      }

      event.tiers = [
        ...(event.tiers || []),
        {
          name,
          price,
          totalSlots,
          remainingSlots: totalSlots,
        },
      ];
      event.markModified('tiers');
      await event.save();

      return NextResponse.json({
        success: true,
        message: 'Ticket tier added successfully.',
        event,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Unsupported action.' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update live event',
      },
      { status: 500 }
    );
  }
}
