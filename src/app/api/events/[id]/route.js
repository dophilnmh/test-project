import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import { normalizeCompetitionCategories } from '@/lib/competitionCategories';
import Organizer from '@/app/models/Organizer';
import { auth } from '@/app/auth';

function slugTierName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

function countWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeEventType(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'competition'
    ? 'competition'
    : 'ticketing';
}

function normalizeTiers(tiers) {
  const input = Array.isArray(tiers) ? tiers : [];
  const merged = [];
  const seen = new Set();

  for (const tier of input) {
    const name = slugTierName(tier?.name);
    if (!name || seen.has(name)) continue;

    const totalSlots = Math.max(0, Number(tier?.totalSlots || 0));
    const price = Math.max(0, Number(tier?.price || 0));

    seen.add(name);
    merged.push({
      name,
      price,
      description: String(tier?.description || '').trim(),
      isActive: tier?.isActive !== false,
      totalSlots,
      remainingSlots: totalSlots,
    });
  }

  if (merged.length > 0) return merged;

  return [{ name: 'regular', price: 0, totalSlots: 0, remainingSlots: 0 }];
}

function normalizeContestants(contestants) {
  const input = Array.isArray(contestants) ? contestants : [];
  const merged = [];
  const seen = new Set();

  for (const contestant of input) {
    const fullName = String(contestant?.fullName || '').trim();
    const category = String(contestant?.category || '').trim();
    const profileImageUrl = String(contestant?.profileImageUrl || '').trim();
    const votes = Math.max(0, Number(contestant?.votes || 0));
    const dedupeKey = `${fullName.toLowerCase()}::${category.toLowerCase()}`;

    if (!fullName || !category || seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    merged.push({ fullName, category, profileImageUrl, votes });
  }

  return merged;
}

function normalizeVotePackages(votePackages, organizer) {
  const input = Array.isArray(votePackages) ? votePackages : [];
  const merged = [];
  const seen = new Set();

  for (const pkg of input) {
    const name = String(pkg?.name || '').trim();
    const normalizedName = name.toLowerCase();
    const votes = Math.max(1, Number(pkg?.votes || 1));
    const price = Math.max(1, Number(pkg?.price || 0));
    const isActive = pkg?.isActive !== false;

    if (!name || seen.has(normalizedName)) continue;

    seen.add(normalizedName);
    merged.push({ name, votes, price, isActive });
  }

  if (merged.length > 0) return merged;

  const organizerDefaults = organizer?.settings?.votePackages || [];
  for (const pkg of organizerDefaults) {
    const name = String(pkg?.name || '').trim();
    const normalizedName = name.toLowerCase();
    const votes = Math.max(1, Number(pkg?.votes || 1));
    const price = Math.max(1, Number(pkg?.price || 0));
    const isActive = pkg?.isActive !== false;

    if (!name || seen.has(normalizedName)) continue;

    seen.add(normalizedName);
    merged.push({ name, votes, price, isActive });
  }

  if (merged.some((pkg) => pkg.isActive !== false)) return merged;

  return [
    { name: 'Basic', votes: 1, price: 20, isActive: true },
    { name: 'Supporter', votes: 5, price: 100, isActive: true },
    { name: 'Champion', votes: 10, price: 200, isActive: true },
  ];
}

function normalizeCompetitionMaxVotes(value, fallback = 1000) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10000, Math.max(1, parsed));
}

function normalizePublicVoteDisplay(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return ['count', 'percent', 'hide'].includes(normalized)
    ? normalized
    : 'count';
}

async function getAuthorizedContext() {
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

export async function GET(_, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid event id' },
        { status: 400 }
      );
    }

    await connect();
    const event = await Event.findOne({ _id: id, status: 'approved' }).lean();
    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        tiers: (event.tiers || []).filter((tier) => tier.isActive !== false),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load event' },
      { status: 500 }
    );
  }
}

export async function PUT(req, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid event id' },
        { status: 400 }
      );
    }

    const authContext = await getAuthorizedContext();
    if (authContext.error) return authContext.error;

    const { organizer } = authContext;
    const existing = await Event.findOne({
      _id: id,
      organizerId: organizer._id,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    if (existing.status === 'approved') {
      return NextResponse.json(
        {
          success: false,
          message:
            'Approved events cannot be edited from organizer submissions.',
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const {
      title,
      eventType,
      description,
      category,
      venue,
      city,
      bannerUrl,
      startDateTime,
      endDateTime,
      tiers,
      categories,
      contestants,
      votePackages,
      maxVotesPerTransaction,
      publicVoteDisplay,
    } = body || {};

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
        { success: false, message: 'Missing required event fields' },
        { status: 400 }
      );
    }

    if (
      (Array.isArray(tiers) ? tiers : []).some(
        (tier) => countWords(tier?.description) > 1000
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ticket descriptions cannot exceed 1000 words.',
        },
        { status: 400 }
      );
    }

    const parsedStart = new Date(startDateTime);
    const parsedEnd = new Date(endDateTime);
    const now = new Date();

    if (
      Number.isNaN(parsedStart.getTime()) ||
      Number.isNaN(parsedEnd.getTime())
    ) {
      return NextResponse.json(
        { success: false, message: 'Invalid event date or time format' },
        { status: 400 }
      );
    }

    if (parsedStart <= now) {
      return NextResponse.json(
        { success: false, message: 'Event start date must be in the future' },
        { status: 400 }
      );
    }

    if (parsedEnd <= parsedStart) {
      return NextResponse.json(
        {
          success: false,
          message: 'Event end date must be later than start date',
        },
        { status: 400 }
      );
    }

    const normalizedEventType = normalizeEventType(eventType);
    const normalizedCompetitionCategories =
      normalizeCompetitionCategories(categories);
    const normalizedContestants = normalizeContestants(contestants);
    const normalizedVotePackages = normalizeVotePackages(
      votePackages,
      organizer
    );
    const normalizedCompetitionMaxVotes = normalizeCompetitionMaxVotes(
      maxVotesPerTransaction,
      Number(existing?.competition?.maxVotesPerTransaction || 1000)
    );
    const normalizedPublicVoteDisplay =
      normalizePublicVoteDisplay(publicVoteDisplay);

    if (
      normalizedEventType === 'competition' &&
      normalizedCompetitionCategories.length < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Add at least one category for a competition event.',
        },
        { status: 400 }
      );
    }

    const categoryNames = new Set(
      normalizedCompetitionCategories.map((name) => name.toLowerCase())
    );
    const hasInvalidContestantCategory = (
      Array.isArray(contestants) ? contestants : []
    ).some((contestant) => {
      const fullName = String(contestant?.fullName || '').trim();
      const contestantCategory = String(contestant?.category || '')
        .trim()
        .toLowerCase();
      return fullName && !categoryNames.has(contestantCategory);
    });

    if (normalizedEventType === 'competition' && hasInvalidContestantCategory) {
      return NextResponse.json(
        {
          success: false,
          message: 'Select a category for every contestant.',
        },
        { status: 400 }
      );
    }

    if (
      normalizedEventType === 'competition' &&
      normalizedContestants.length < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Add at least one contestant for a competition event.',
        },
        { status: 400 }
      );
    }

    if (
      normalizedEventType === 'competition' &&
      !normalizedVotePackages.some((pkg) => pkg.isActive !== false)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Add at least one active vote package for a competition event.',
        },
        { status: 400 }
      );
    }

    existing.title = String(title).trim();
    existing.eventType = normalizedEventType;
    existing.description = String(description).trim();
    existing.category = String(category).trim();
    existing.venue = String(venue).trim();
    existing.city = String(city).trim();
    existing.bannerUrl = String(bannerUrl || '').trim();
    existing.startDateTime = parsedStart;
    existing.endDateTime = parsedEnd;
    existing.status = 'pending';

    if (normalizedEventType === 'ticketing') {
      existing.tiers = normalizeTiers(tiers);
      existing.competition = {
        categories: [],
        maxVotesPerTransaction: 1000,
        publicVoteDisplay: 'count',
        contestants: [],
        votePackages: [],
      };
    } else {
      existing.tiers = [];
      existing.competition = {
        categories: normalizedCompetitionCategories,
        maxVotesPerTransaction: normalizedCompetitionMaxVotes,
        publicVoteDisplay: normalizedPublicVoteDisplay,
        contestants: normalizedContestants,
        votePackages: normalizedVotePackages,
      };
    }

    await existing.save();

    return NextResponse.json({
      success: true,
      message: 'Event submission updated and moved to pending review',
      event: existing,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update event' },
      { status: 500 }
    );
  }
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

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can update events' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const hasTierUpdate = Array.isArray(body?.tiers);
    const hasStatusUpdate = body?.status !== undefined;
    const hasTicketEventUpdate = body?.ticketEventId !== undefined;
    const hasScheduleUpdate =
      body?.startDateTime !== undefined || body?.endDateTime !== undefined;
    const nextStatus = String(body?.status || '').trim();
    const allowedStatus = ['pending', 'approved', 'rejected'];

    if (
      !hasStatusUpdate &&
      !hasTierUpdate &&
      !hasTicketEventUpdate &&
      !hasScheduleUpdate
    ) {
      return NextResponse.json(
        { success: false, message: 'No event changes were provided.' },
        { status: 400 }
      );
    }

    if (hasStatusUpdate && !allowedStatus.includes(nextStatus)) {
      return NextResponse.json(
        { success: false, message: 'Unsupported event status' },
        { status: 400 }
      );
    }

    await connect();
    const existing = await Event.findById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    if (hasTicketEventUpdate || (hasStatusUpdate && nextStatus === 'approved' && existing.eventType === 'competition')) {
      if (existing.eventType !== 'competition') {
        return NextResponse.json(
          {
            success: false,
            message: 'Only competitions can be linked to a ticketing event.',
          },
          { status: 400 }
        );
      }

      const ticketEventId = String(
        body?.ticketEventId || existing.competition?.ticketEventId || ''
      ).trim();
      if (
        existing.status === 'approved' &&
        hasTicketEventUpdate &&
        !String(body?.ticketEventId || '').trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Approved competitions must remain linked to a ticketing event.',
          },
          { status: 400 }
        );
      }
      if (
        hasStatusUpdate &&
        nextStatus === 'approved' &&
        !ticketEventId
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Select a ticketing event before approving this competition.',
          },
          { status: 400 }
        );
      }
      if (ticketEventId) {
        if (!mongoose.Types.ObjectId.isValid(ticketEventId)) {
          return NextResponse.json(
            { success: false, message: 'Invalid ticketing event id.' },
            { status: 400 }
          );
        }
        const ticketEvent = await Event.findOne({
          _id: ticketEventId,
          organizerId: existing.organizerId,
          status: 'approved',
          $or: [{ eventType: 'ticketing' }, { eventType: { $exists: false } }],
        })
          .select('_id')
          .lean();
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
        existing.competition.ticketEventId = ticketEvent._id;
        existing.markModified('competition.ticketEventId');
      } else if (hasTicketEventUpdate) {
        existing.competition.ticketEventId = null;
        existing.markModified('competition.ticketEventId');
      }
    }

    if (hasTierUpdate) {
      if (session.user.role !== 'superadmin') {
        return NextResponse.json(
          {
            success: false,
            message: 'Only the system owner can edit live ticket tiers.',
          },
          { status: 403 }
        );
      }
      if (existing.eventType === 'competition') {
        return NextResponse.json(
          {
            success: false,
            message: 'Competition events do not have ticket tiers.',
          },
          { status: 400 }
        );
      }

      const submittedTiers = body.tiers;
      const names = new Set();
      const matchedExistingTierNames = new Set();
      for (const tier of submittedTiers) {
        const name = slugTierName(tier?.name);
        const price = Number(tier?.price);
        const totalSlots = Math.floor(Number(tier?.totalSlots));
        if (name.length < 2 || names.has(name)) {
          return NextResponse.json(
            {
              success: false,
              message: 'Ticket tier names must be unique and valid.',
            },
            { status: 400 }
          );
        }
        if (
          tier?.price === undefined ||
          tier?.price === null ||
          String(tier.price).trim() === '' ||
          tier?.totalSlots === undefined ||
          tier?.totalSlots === null ||
          String(tier.totalSlots).trim() === '' ||
          !Number.isFinite(price) ||
          price < 0 ||
          !Number.isFinite(totalSlots) ||
          totalSlots < 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                'Ticket price and capacity must be valid non-negative numbers.',
            },
            { status: 400 }
          );
        }
        const originalName = slugTierName(tier?.originalName);
        const previousTier = (existing.tiers || []).find((item) =>
          slugTierName(item.name) === (originalName || name)
        );
        if (originalName && !previousTier) {
          return NextResponse.json(
            { success: false, message: 'A ticket type being edited no longer exists.' },
            { status: 400 }
          );
        }
        if (
          previousTier &&
          matchedExistingTierNames.has(slugTierName(previousTier.name))
        ) {
          return NextResponse.json(
            { success: false, message: 'A ticket type cannot be edited more than once.' },
            { status: 400 }
          );
        }
        if (previousTier) {
          matchedExistingTierNames.add(slugTierName(previousTier.name));
        }
        const sold = previousTier
          ? Math.max(
              0,
              Number(previousTier.totalSlots || 0) -
                Number(previousTier.remainingSlots || 0)
            )
          : 0;
        if (totalSlots < sold) {
          return NextResponse.json(
            {
              success: false,
              message: `Capacity for ${name} cannot be lower than the ${sold} tickets already sold.`,
            },
            { status: 400 }
          );
        }
        if (countWords(tier?.description) > 1000) {
          return NextResponse.json(
            {
              success: false,
              message: 'Ticket descriptions cannot exceed 1000 words.',
            },
            { status: 400 }
          );
        }
        names.add(name);
      }

      const updatedTiers = submittedTiers.map((tier) => {
        const name = slugTierName(tier.name);
        const originalName = slugTierName(tier?.originalName);
        const previousTier = (existing.tiers || []).find(
          (item) =>
            slugTierName(item.name) === (originalName || name)
        );
        const sold = previousTier
          ? Math.max(
              0,
              Number(previousTier.totalSlots || 0) -
                Number(previousTier.remainingSlots || 0)
            )
          : 0;
        const totalSlots = Math.floor(Number(tier.totalSlots));
        return {
          name,
          price: Number(tier.price),
          description: String(tier.description || '').trim(),
          isActive: tier.isActive !== false,
          totalSlots,
          remainingSlots: totalSlots - sold,
        };
      });
      const retainedTiers = (existing.tiers || []).filter(
        (tier) => !matchedExistingTierNames.has(slugTierName(tier.name))
      );
      existing.tiers = [...updatedTiers, ...retainedTiers];
      existing.markModified('tiers');
    }

    if (hasScheduleUpdate) {
      const parsedStart = new Date(
        body.startDateTime ?? existing.startDateTime
      );
      const parsedEnd = new Date(body.endDateTime ?? existing.endDateTime);
      if (
        Number.isNaN(parsedStart.getTime()) ||
        Number.isNaN(parsedEnd.getTime()) ||
        parsedEnd <= parsedStart
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'The event end date and time must be after the start date and time.',
          },
          { status: 400 }
        );
      }
      existing.startDateTime = parsedStart;
      existing.endDateTime = parsedEnd;
    }

    if (hasStatusUpdate) {
      existing.status = nextStatus;
      if (nextStatus === 'approved' && !existing.publishedAt) {
        existing.publishedAt = new Date();
      }
      if (nextStatus !== 'approved') {
        existing.publishedAt = null;
      }
      if (body?.rejectionReason !== undefined) {
        existing.rejectionReason = String(body.rejectionReason || '').trim();
      }
    }

    await existing.save();

    return NextResponse.json({
      success: true,
      message: hasStatusUpdate
        ? `Event status updated to ${nextStatus}`
        : 'Event updated successfully',
      event: existing,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, context) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid event id' },
        { status: 400 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can delete events' },
        { status: 403 }
      );
    }

    await connect();
    const existing = await Event.findById(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Event not found' },
        { status: 404 }
      );
    }

    await Event.deleteOne({ _id: existing._id });

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to delete event' },
      { status: 500 }
    );
  }
}
