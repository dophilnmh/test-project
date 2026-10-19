import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';

export async function POST(req, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid event id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const fullName = String(body?.fullName || '').trim();
    const category = String(body?.category || '').trim();
    const profileImageUrl = String(body?.profileImageUrl || '').trim();

    if (fullName.length < 2 || category.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: 'Contestant name and category are required.',
        },
        { status: 400 }
      );
    }

    await connect();

    const event = await Event.findOne({
      _id: id,
      status: 'approved',
      eventType: 'competition',
    });

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Competition event not found.' },
        { status: 404 }
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

    const duplicate = (event.competition?.contestants || []).some(
      (contestant) =>
        String(contestant.fullName).toLowerCase() === fullName.toLowerCase() &&
        String(contestant.category).toLowerCase() === category.toLowerCase()
    );

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message: 'This contestant is already registered for this event.',
        },
        { status: 409 }
      );
    }

    event.competition.contestants.push({
      fullName,
      category,
      profileImageUrl,
      votes: 0,
    });
    event.markModified('competition.contestants');
    await event.save();

    return NextResponse.json({
      success: true,
      message: 'Contestant registered successfully.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to register contestant.',
      },
      { status: 500 }
    );
  }
}
