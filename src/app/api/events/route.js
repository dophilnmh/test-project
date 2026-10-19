import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import Organizer from '@/app/models/Organizer';
import User from '@/app/models/User';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';
import { normalizeCompetitionCategories } from '@/lib/competitionCategories';

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

function normalizeTiers(tiers, organizer) {
  const input = Array.isArray(tiers) ? tiers : [];
  const merged = [];
  const seen = new Set();

  for (const tier of input) {
    const name = slugTierName(tier?.name);
    if (!name || seen.has(name)) continue;

    const totalSlots = Math.max(0, Number(tier.totalSlots || 0));
    const price = Math.max(0, Number(tier.price || 0));

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

  const organizerDefaults = organizer?.settings?.ticketTypes || [];
  for (const tier of organizerDefaults) {
    if (tier?.isActive === false) continue;
    const name = slugTierName(tier?.name);
    if (!name || seen.has(name)) continue;

    const totalSlots = Math.max(0, Number(tier.defaultSlots || 0));
    const price = Math.max(0, Number(tier.defaultPrice || 0));

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
    merged.push({
      fullName,
      category,
      profileImageUrl,
      votes,
    });
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
    merged.push({
      name,
      votes,
      price,
      isActive,
    });
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
    merged.push({
      name,
      votes,
      price,
      isActive,
    });
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

export async function GET(req) {
  try {
    await connect();

    const { searchParams } = new URL(req.url);
    const scope = String(searchParams.get('scope') || '')
      .trim()
      .toLowerCase();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get('limit') || 10))
    );
    const q = String(searchParams.get('q') || '').trim();
    const includeAllEventTypes = scope === 'all';

    const session = scope === 'admin' ? await auth() : null;
    if (scope === 'admin') {
      if (!session?.user) {
        return NextResponse.json(
          { success: false, message: 'Authentication required' },
          { status: 401 }
        );
      }

      if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
        return NextResponse.json(
          {
            success: false,
            message: 'Only admins can access event management',
          },
          { status: 403 }
        );
      }
    }

    const filter =
      scope === 'admin'
        ? {}
        : scope === 'landing'
          ? { status: 'approved', eventType: 'competition' }
          : includeAllEventTypes
            ? { status: 'approved' }
            : {
                status: 'approved',
                $or: [
                  { eventType: 'ticketing' },
                  { eventType: { $exists: false } },
                ],
              };

    if (scope !== 'admin' && q) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { category: { $regex: q, $options: 'i' } },
            { city: { $regex: q, $options: 'i' } },
          ],
        },
      ];
    }

    if (scope === 'admin' && q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { organizerName: { $regex: q, $options: 'i' } },
      ];
    }

    if (scope === 'admin') {
      const [events, total] = await Promise.all([
        Event.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Event.countDocuments(filter),
      ]);

      return NextResponse.json({
        success: true,
        events,
        canEditTicketTiers: session.user.role === 'superadmin',
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    }

    const events = await Event.find(filter)
      .sort({ publishedAt: -1, startDateTime: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      events: events.map((event) => ({
        ...event,
        tiers: (event.tiers || []).filter((tier) => tier.isActive !== false),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load events' },
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

    const role = session.user.role;
    if (!['organizer', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Only organizers can create events' },
        { status: 403 }
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
        {
          success: false,
          message: 'Event start date must be in the future',
        },
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

    await connect();

    let organizer = await Organizer.findOne({ email: session.user.email });
    if (!organizer && role !== 'organizer') {
      const managedPassword = await bcrypt.hash('managed-by-admin', 10);
      organizer = await Organizer.create({
        organizationName: session.user.name || 'Admin Organizer',
        contactName: session.user.name || 'Admin Organizer',
        email: session.user.email,
        phone: '0700000000',
        county: 'Nairobi',
        subCounty: 'Westlands',
        password: managedPassword,
        role: 'organizer',
        status: 'active',
      });
    }

    if (!organizer) {
      return NextResponse.json(
        {
          success: false,
          message: 'Organizer account not found. Please register first.',
        },
        { status: 404 }
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
      1000
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

    const event = await Event.create({
      organizerId: organizer._id,
      organizerName: organizer.organizationName,
      submittedByName: String(session.user.name || '').trim(),
      submittedByEmail: String(session.user.email || '').trim(),
      submittedByRole: String(session.user.role || '').trim(),
      title: String(title).trim(),
      eventType: normalizedEventType,
      description: String(description).trim(),
      category: String(category).trim(),
      venue: String(venue).trim(),
      city: String(city).trim(),
      bannerUrl: String(bannerUrl || '').trim(),
      startDateTime: parsedStart,
      endDateTime: parsedEnd,
      status: 'pending',
      tiers:
        normalizedEventType === 'ticketing'
          ? normalizeTiers(tiers, organizer)
          : [],
      competition:
        normalizedEventType === 'competition'
          ? {
              categories: normalizedCompetitionCategories,
              maxVotesPerTransaction: normalizedCompetitionMaxVotes,
              publicVoteDisplay: normalizedPublicVoteDisplay,
              contestants: normalizedContestants,
              votePackages: normalizedVotePackages,
            }
          : {
              categories: [],
              maxVotesPerTransaction: 1000,
              publicVoteDisplay: 'count',
              contestants: [],
              votePackages: [],
            },
    });

    const superadmins = await User.find({ role: 'superadmin' })
      .select(
        'name email notificationPhone phone notificationEmailEnabled notificationSmsEnabled'
      )
      .lean();

    const notificationJobs = [];

    for (const recipient of superadmins) {
      if (recipient?.email && recipient.notificationEmailEnabled !== false) {
        notificationJobs.push(
          sendMailSafe({
            to: recipient.email,
            subject: 'New organizer event submitted',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                <h2>New Event Submitted</h2>
                <p><strong>Organizer:</strong> ${organizer.organizationName}</p>
                <p><strong>Contact Name:</strong> ${organizer.contactName || '-'}</p>
                <p><strong>Contact Email:</strong> ${organizer.email || '-'}</p>
                <p><strong>Contact Phone:</strong> ${organizer.phone || '-'}</p>
                <p><strong>Submitted By:</strong> ${event.submittedByName || 'Unknown'} (${event.submittedByEmail || 'Unknown'})</p>
                <p><strong>Submitter Role:</strong> ${event.submittedByRole || '-'}</p>
                <p><strong>Title:</strong> ${event.title}</p>
                <p><strong>Category:</strong> ${event.category}</p>
                <p><strong>Venue:</strong> ${event.venue}, ${event.city}</p>
                <p><strong>Starts:</strong> ${new Date(event.startDateTime).toLocaleString()}</p>
                <p>The event is now pending admin approval.</p>
              </div>
            `,
            text: `New event submitted by ${organizer.organizationName}. Contact: ${organizer.contactName || '-'} (${organizer.email || '-'}, ${organizer.phone || '-'}). Submitted by: ${event.submittedByName || 'Unknown'} (${event.submittedByEmail || 'Unknown'}) role ${event.submittedByRole || '-'}. Title: ${event.title}. Category: ${event.category}. Venue: ${event.venue}, ${event.city}. Starts: ${new Date(event.startDateTime).toLocaleString()}.`,
          })
        );
      }

      const smsPhone = recipient.notificationPhone || recipient.phone;
      if (smsPhone && recipient.notificationSmsEnabled) {
        notificationJobs.push(
          sendSmsSafe({
            phone: smsPhone,
            message: `New event on NimblyPolls: ${event.title} by ${organizer.organizationName}. Contact ${organizer.contactName || ''} ${organizer.phone || ''}. Submitted by ${event.submittedByName || 'Unknown'}. Review in admin approvals.`,
          })
        );
      }
    }

    const notificationResults = await Promise.allSettled(notificationJobs);
    const notificationsSent = notificationResults.filter(
      (item) => item.status === 'fulfilled' && item.value?.ok
    ).length;

    return NextResponse.json({
      success: true,
      message: 'Event submitted for admin approval',
      event,
      notificationsSent,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to create event' },
      { status: 500 }
    );
  }
}
