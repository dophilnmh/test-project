import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';

function summarizeCompetition(event) {
  const contestants = event?.competition?.contestants || [];
  const totalVotes = contestants.reduce(
    (sum, contestant) => sum + Number(contestant?.votes || 0),
    0
  );

  return {
    _id: event._id,
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    city: event.city,
    bannerUrl: event.bannerUrl,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    organizerName: event.organizerName,
    contestantsCount: contestants.length,
    totalVotes,
  };
}

export async function GET() {
  try {
    await connect();

    const events = await Event.find({
      status: 'approved',
      eventType: 'competition',
    })
      .sort({ startDateTime: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      competitions: events.map(summarizeCompetition),
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
