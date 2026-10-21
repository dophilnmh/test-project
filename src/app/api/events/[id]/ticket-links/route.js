import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';

async function getAuthorizedCompetition(id) {
  const session = await auth();
  if (!['admin', 'superadmin'].includes(session?.user?.role)) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Only admins can manage contestant ticket links.' },
        { status: session?.user ? 403 : 401 }
      ),
    };
  }

  await connect();
  const competition = await Event.findOne({
    _id: id,
    eventType: 'competition',
  });
  if (!competition) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Competition not found.' },
        { status: 404 }
      ),
    };
  }
  return { competition };
}

export async function GET(_, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id.' },
        { status: 400 }
      );
    }

    const result = await getAuthorizedCompetition(id);
    if (result.error) return result.error;

    const ticketEvents = await Event.find({
      organizerId: result.competition.organizerId,
      status: 'approved',
      $or: [{ eventType: 'ticketing' }, { eventType: { $exists: false } }],
    })
      .select('_id title startDateTime')
      .sort({ startDateTime: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      ticketEventId: String(
        result.competition.competition?.ticketEventId || ''
      ),
      ticketEvents: ticketEvents.map((event) => ({
        _id: String(event._id),
        title: event.title,
        startDateTime: event.startDateTime,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load competition ticket events.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id.' },
        { status: 400 }
      );
    }

    const result = await getAuthorizedCompetition(id);
    if (result.error) return result.error;

    const body = await request.json();
    const ticketEventId = String(body?.ticketEventId || '').trim();
    if (!ticketEventId && result.competition.status === 'approved') {
      return NextResponse.json(
        {
          success: false,
          message: 'Approved competitions must remain linked to a ticketing event.',
        },
        { status: 400 }
      );
    }
    let ticketEvent = null;
    if (ticketEventId) {
      if (!mongoose.Types.ObjectId.isValid(ticketEventId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid ticket event id.' },
          { status: 400 }
        );
      }
      ticketEvent = await Event.findOne({
        _id: ticketEventId,
        organizerId: result.competition.organizerId,
        status: 'approved',
        $or: [{ eventType: 'ticketing' }, { eventType: { $exists: false } }],
      }).select('_id');
      if (!ticketEvent) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Choose an approved ticketing event owned by this competition organizer.',
          },
          { status: 400 }
        );
      }
    }

    if (!result.competition.competition) result.competition.competition = {};
    result.competition.competition.ticketEventId = ticketEvent?._id || null;
    result.competition.markModified('competition.ticketEventId');
    await result.competition.save();

    return NextResponse.json({
      success: true,
      message: ticketEvent
        ? 'Contestant ticket links now point to the selected event.'
        : 'Competition ticket event cleared.',
      ticketEventId: String(ticketEvent?._id || ''),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update contestant ticket links.',
      },
      { status: 500 }
    );
  }
}
