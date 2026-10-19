import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';

function normalizeTierName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

function normalizeTicketTypes(ticketTypes) {
  const input = Array.isArray(ticketTypes) ? ticketTypes : [];
  const seen = new Set();
  const normalized = [];

  for (const item of input) {
    const name = normalizeTierName(item?.name);
    if (!name || seen.has(name)) continue;

    seen.add(name);
    normalized.push({
      name,
      defaultPrice: Math.max(0, Number(item?.defaultPrice || 0)),
      defaultSlots: Math.max(0, Number(item?.defaultSlots || 0)),
      isActive: item?.isActive !== false,
    });
  }

  if (normalized.length > 0) return normalized;

  return [
    { name: 'vip', defaultPrice: 0, defaultSlots: 0, isActive: true },
    { name: 'regular', defaultPrice: 0, defaultSlots: 0, isActive: true },
  ];
}

function normalizeCalendar(calendar) {
  const source = calendar || {};
  const weekStartsOn = source.weekStartsOn === 'sunday' ? 'sunday' : 'monday';
  const defaultEventDurationHours = Math.min(
    24,
    Math.max(1, Number(source.defaultEventDurationHours || 4))
  );

  return {
    timezone:
      String(source.timezone || 'Africa/Nairobi').trim() || 'Africa/Nairobi',
    weekStartsOn,
    defaultEventDurationHours,
  };
}

function normalizeVotePackages(votePackages) {
  const input = Array.isArray(votePackages) ? votePackages : [];
  const normalized = [];
  const seenNames = new Set();

  for (const item of input) {
    const name = String(item?.name || '').trim();
    const dedupe = name.toLowerCase();
    if (!name || seenNames.has(dedupe)) continue;

    seenNames.add(dedupe);
    normalized.push({
      name,
      votes: Math.max(1, Number(item?.votes || 1)),
      price: Math.max(1, Number(item?.price || 0)),
      isActive: item?.isActive !== false,
    });
  }

  if (normalized.some((item) => item.isActive !== false)) return normalized;

  return [
    { name: 'Basic', votes: 1, price: 20, isActive: true },
    { name: 'Supporter', votes: 5, price: 100, isActive: true },
    { name: 'Champion', votes: 10, price: 200, isActive: true },
  ];
}

function normalizePromoters(promoters) {
  const input = Array.isArray(promoters) ? promoters : [];
  const normalized = [];
  const seenEmails = new Set();

  for (const item of input) {
    const email = String(item?.email || '')
      .trim()
      .toLowerCase();
    const name = String(item?.name || '').trim();
    if (!name || !email || seenEmails.has(email)) continue;

    seenEmails.add(email);

    const accessLevel = ['viewer', 'sales', 'editor'].includes(
      item?.accessLevel
    )
      ? item.accessLevel
      : 'viewer';

    normalized.push({
      name,
      email,
      phone: String(item?.phone || '').trim(),
      accessLevel,
      canManageTickets: Boolean(item?.canManageTickets),
      canViewAnalytics: item?.canViewAnalytics !== false,
      isActive: item?.isActive !== false,
    });
  }

  return normalized;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    await connect();

    const organizer = await Organizer.findOne({
      email: String(session.user.email).toLowerCase(),
    }).lean();

    if (!organizer) {
      return NextResponse.json(
        { success: false, message: 'Organizer account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: {
        notificationSmsEnabled: Boolean(organizer.notificationSmsEnabled),
        ticketTypes: normalizeTicketTypes(organizer.settings?.ticketTypes),
        votePackages: normalizeVotePackages(organizer.settings?.votePackages),
        calendar: normalizeCalendar(organizer.settings?.calendar),
      },
      promoters: normalizePromoters(organizer.promoters),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const ticketTypes = normalizeTicketTypes(body?.settings?.ticketTypes);
    const votePackages = normalizeVotePackages(body?.settings?.votePackages);
    const calendar = normalizeCalendar(body?.settings?.calendar);
    const notificationSmsEnabled = Boolean(
      body?.settings?.notificationSmsEnabled
    );
    const promoters = normalizePromoters(body?.promoters);

    await connect();

    const existing = await Organizer.findOne({
      email: String(session.user.email).toLowerCase(),
    }).lean();

    const organizer = await Organizer.findOneAndUpdate(
      { email: String(session.user.email).toLowerCase() },
      {
        $set: {
          notificationSmsEnabled,
          settings: { ticketTypes, votePackages, calendar },
          promoters,
        },
      },
      { new: true }
    ).lean();

    if (!organizer) {
      return NextResponse.json(
        { success: false, message: 'Organizer account not found' },
        { status: 404 }
      );
    }

    const previousPromoters = Array.isArray(existing?.promoters)
      ? existing.promoters
      : [];
    const previousMap = new Map(
      previousPromoters.map((item) => [
        String(item.email || '')
          .trim()
          .toLowerCase(),
        item,
      ])
    );

    const mails = [];

    mails.push(
      sendMailSafe({
        to: organizer.email,
        subject: 'Organizer settings updated',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
            <h2>Settings Updated</h2>
            <p>Your organizer settings have been updated successfully.</p>
            <p><strong>Ticket types:</strong> ${ticketTypes.length}</p>
            <p><strong>Vote packages:</strong> ${votePackages.length}</p>
            <p><strong>Promoters:</strong> ${promoters.length}</p>
            <p><strong>Timezone:</strong> ${calendar.timezone}</p>
            <p><strong>SMS notifications:</strong> ${notificationSmsEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        `,
        text: `Organizer settings updated. Ticket types: ${ticketTypes.length}. Vote packages: ${votePackages.length}. Promoters: ${promoters.length}. Timezone: ${calendar.timezone}. SMS notifications: ${notificationSmsEnabled ? 'Enabled' : 'Disabled'}.`,
      })
    );

    for (const promoter of promoters) {
      const email = String(promoter.email || '')
        .trim()
        .toLowerCase();
      if (!email) continue;

      const previous = previousMap.get(email);
      const changed =
        !previous ||
        previous.accessLevel !== promoter.accessLevel ||
        Boolean(previous.canManageTickets) !==
          Boolean(promoter.canManageTickets) ||
        Boolean(previous.canViewAnalytics) !==
          Boolean(promoter.canViewAnalytics) ||
        Boolean(previous.isActive) !== Boolean(promoter.isActive);

      if (!changed) continue;

      mails.push(
        sendMailSafe({
          to: email,
          subject: 'Promoter access update - NimblyPolls',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
              <h2>Hello ${promoter.name},</h2>
              <p>Your promoter access was updated by ${organizer.organizationName}.</p>
              <p><strong>Access level:</strong> ${promoter.accessLevel}</p>
              <p><strong>Can manage tickets:</strong> ${promoter.canManageTickets ? 'Yes' : 'No'}</p>
              <p><strong>Can view analytics:</strong> ${promoter.canViewAnalytics ? 'Yes' : 'No'}</p>
              <p><strong>Status:</strong> ${promoter.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          `,
          text: `Hello ${promoter.name}, your promoter access was updated. Access level: ${promoter.accessLevel}. Can manage tickets: ${promoter.canManageTickets ? 'Yes' : 'No'}. Can view analytics: ${promoter.canViewAnalytics ? 'Yes' : 'No'}. Status: ${promoter.isActive ? 'Active' : 'Inactive'}.`,
        })
      );
    }

    const mailResults = await Promise.allSettled(mails);
    const mailsSent = mailResults.filter(
      (item) => item.status === 'fulfilled' && item.value?.ok
    ).length;

    return NextResponse.json({
      success: true,
      message: 'Organizer settings updated',
      emailsSent: mailsSent,
      settings: {
        notificationSmsEnabled: Boolean(organizer.notificationSmsEnabled),
        ticketTypes: normalizeTicketTypes(organizer.settings?.ticketTypes),
        votePackages: normalizeVotePackages(organizer.settings?.votePackages),
        calendar: normalizeCalendar(organizer.settings?.calendar),
      },
      promoters: normalizePromoters(organizer.promoters),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update settings' },
      { status: 500 }
    );
  }
}
