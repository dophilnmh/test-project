import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';

function contestantKey(contestant) {
  return `${String(contestant?.fullName || '')
    .trim()
    .toLowerCase()}::${String(contestant?.category || '')
    .trim()
    .toLowerCase()}`;
}

export async function GET(req, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id' },
        { status: 400 }
      );
    }

    await connect();

    const event = await Event.findOne({
      _id: id,
      status: 'approved',
      eventType: 'competition',
    }).lean();

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Competition not found' },
        { status: 404 }
      );
    }

    const contestants = (event.competition?.contestants || []).map((item) => ({
      fullName: item.fullName,
      category: item.category,
      profileImageUrl: item.profileImageUrl || '',
      votes: Number(item.votes || 0),
      key: contestantKey(item),
    }));
    const categories = Array.from(
      new Set(
        [
          ...(event.competition?.categories || []),
          ...contestants.map((contestant) => contestant.category),
        ]
          .map((category) => String(category || '').trim())
          .filter(Boolean)
      )
    );

    const votePackages = (event.competition?.votePackages || [])
      .filter((item) => item?.isActive !== false)
      .map((item) => ({
        _id: String(item._id || ''),
        name: item.name,
        votes: Math.max(1, Number(item.votes || 1)),
        price: Math.max(1, Number(item.price || 0)),
      }));

    const totalVotes = contestants.reduce(
      (sum, contestant) => sum + Number(contestant.votes || 0),
      0
    );

    return NextResponse.json({
      success: true,
      competition: {
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
        voteDisplayMode:
          String(event.competition?.voteDisplayMode || '').trim() ===
          'real_plus_dummy'
            ? 'real_plus_dummy'
            : 'real',
        publicVoteDisplay:
          String(event.competition?.publicVoteDisplay || '').trim() ===
          'percent'
            ? 'percent'
            : String(event.competition?.publicVoteDisplay || '').trim() ===
                'hide'
              ? 'hide'
              : 'count',
        maxVotesPerTransaction: Math.max(
          1,
          Number(event.competition?.maxVotesPerTransaction || 1000)
        ),
        categories,
        contestants,
        votePackages,
        totalVotes,
      },
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
