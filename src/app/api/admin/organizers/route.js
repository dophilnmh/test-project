import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';
import Event from '@/app/models/Event';
import User from '@/app/models/User';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';
import { sendSmsSafe } from '@/lib/sms';

export const runtime = 'nodejs';

function normalizePage(value) {
  const parsed = Number.parseInt(String(value || '1'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || '10'), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 50);
}

function buildOrganizerFilter({ q, status }) {
  const filter = {};

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (q) {
    filter.$or = [
      { organizationName: { $regex: q, $options: 'i' } },
      { contactName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { county: { $regex: q, $options: 'i' } },
      { subCounty: { $regex: q, $options: 'i' } },
    ];
  }

  return filter;
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    await connect();

    const { searchParams } = new URL(req.url);
    const page = normalizePage(searchParams.get('page'));
    const limit = normalizeLimit(searchParams.get('limit'));
    const q = String(searchParams.get('q') || '').trim();
    const status = String(searchParams.get('status') || 'all').trim();

    const filter = buildOrganizerFilter({ q, status });
    const skip = (page - 1) * limit;

    const [
      organizers,
      totalMatching,
      statusCounts,
      totalEventsAllOrganizers,
      totalOrganizers,
    ] = await Promise.all([
      Organizer.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Organizer.countDocuments(filter),
      Organizer.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Event.countDocuments({}),
      Organizer.countDocuments({}),
    ]);

    const organizerIds = organizers.map((item) => item._id);

    const eventCounts = await Event.aggregate([
      {
        $match: {
          organizerId: { $in: organizerIds },
        },
      },
      {
        $group: {
          _id: '$organizerId',
          totalEvents: { $sum: 1 },
          approvedEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
          },
          pendingEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
        },
      },
    ]);

    const countsByOrganizerId = new Map(
      eventCounts.map((item) => [String(item._id), item])
    );

    const rows = organizers.map((organizer) => {
      const counts = countsByOrganizerId.get(String(organizer._id));

      return {
        id: String(organizer._id),
        organizationName: organizer.organizationName,
        contactName: organizer.contactName,
        email: organizer.email,
        phone: organizer.phone,
        county: organizer.county || '',
        subCounty: organizer.subCounty || '',
        status: organizer.status || 'active',
        createdAt: organizer.createdAt,
        totalEvents: counts?.totalEvents || 0,
        approvedEvents: counts?.approvedEvents || 0,
        pendingEvents: counts?.pendingEvents || 0,
      };
    });

    const statusSummary = statusCounts.reduce(
      (acc, item) => ({
        ...acc,
        [String(item._id || 'unknown')]: Number(item.count || 0),
      }),
      {}
    );

    const totalPages = Math.max(1, Math.ceil(totalMatching / limit));

    return NextResponse.json({
      success: true,
      organizers: rows,
      pagination: {
        page,
        limit,
        totalItems: totalMatching,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summary: {
        organizers: totalOrganizers,
        active: Number(statusSummary.active || 0),
        pending: Number(statusSummary.pending || 0),
        suspended: Number(statusSummary.suspended || 0),
        totalEvents: totalEventsAllOrganizers,
      },
      canDeleteOrganizers: session.user.role === 'superadmin',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to fetch organizers',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const organizerId = String(body?.organizerId || '').trim();
    const organizerIds = Array.isArray(body?.organizerIds)
      ? body.organizerIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const nextStatus = String(body?.status || '').trim();

    const targetIds = Array.from(
      new Set([...(organizerId ? [organizerId] : []), ...organizerIds])
    );

    if (!targetIds.length) {
      return NextResponse.json(
        { success: false, message: 'At least one organizer id is required' },
        { status: 400 }
      );
    }

    if (!['pending', 'active', 'suspended'].includes(nextStatus)) {
      return NextResponse.json(
        { success: false, message: 'Invalid organizer status' },
        { status: 400 }
      );
    }

    await connect();

    const existingOrganizers = await Organizer.find({ _id: { $in: targetIds } })
      .select('email phone contactName organizationName status')
      .lean();
    const organizerMap = new Map(
      existingOrganizers.map((item) => [String(item._id), item])
    );

    const superadmins = await User.find({ role: 'superadmin' })
      .select(
        'email notificationPhone phone notificationEmailEnabled notificationSmsEnabled'
      )
      .lean();

    const updateResult = await Organizer.updateMany(
      { _id: { $in: targetIds } },
      { status: nextStatus }
    );

    if (!updateResult.matchedCount) {
      return NextResponse.json(
        { success: false, message: 'Organizer(s) not found' },
        { status: 404 }
      );
    }

    const messageMap = {
      active: 'approved',
      pending: 'marked as pending',
      suspended: 'suspended',
    };

    const notificationJobs = [];

    for (const organizerId of targetIds) {
      const organizer = organizerMap.get(organizerId);
      if (!organizer) continue;

      if (organizer.email) {
        notificationJobs.push(
          sendMailSafe({
            to: organizer.email,
            subject: `Organizer account ${messageMap[nextStatus] || nextStatus}`,
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                <h2>Organizer Account Update</h2>
                <p>Hello ${organizer.contactName || organizer.organizationName || 'Organizer'},</p>
                <p>Your organizer account for <strong>${organizer.organizationName}</strong> has been ${messageMap[nextStatus] || nextStatus}.</p>
              </div>
            `,
            text: `Your organizer account for ${organizer.organizationName} has been ${messageMap[nextStatus] || nextStatus}.`,
          })
        );
      }

      const smsPhone = organizer.phone;
      if (smsPhone && organizer.notificationSmsEnabled) {
        notificationJobs.push(
          sendSmsSafe({
            phone: smsPhone,
            message: `Your organizer account for ${organizer.organizationName} has been ${messageMap[nextStatus] || nextStatus}.`,
          })
        );
      }
    }

    for (const admin of superadmins) {
      if (admin.email && admin.notificationEmailEnabled !== false) {
        notificationJobs.push(
          sendMailSafe({
            to: admin.email,
            subject: 'Organizer approval updated',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
                <h2>Organizer Status Changed</h2>
                <p>${targetIds.length} organizer account(s) were updated to <strong>${nextStatus}</strong>.</p>
              </div>
            `,
            text: `${targetIds.length} organizer account(s) were updated to ${nextStatus}.`,
          })
        );
      }

      const smsPhone = admin.notificationPhone || admin.phone;
      if (smsPhone && admin.notificationSmsEnabled) {
        notificationJobs.push(
          sendSmsSafe({
            phone: smsPhone,
            message: `${targetIds.length} organizer account(s) were updated to ${nextStatus}.`,
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
      message:
        targetIds.length > 1
          ? `${updateResult.modifiedCount} organizer accounts ${nextStatus === 'active' ? 'activated' : 'suspended'}`
          : `Organizer ${nextStatus === 'active' ? 'approved' : nextStatus === 'pending' ? 'set to pending' : 'suspended'}`,
      updatedCount: updateResult.modifiedCount,
      status: nextStatus,
      organizerIds: targetIds,
      notificationsSent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update organizer status',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only the system owner can delete organizers.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const organizerId = String(body?.organizerId || '').trim();
    const organizerIds = Array.isArray(body?.organizerIds)
      ? body.organizerIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const targetIds = Array.from(
      new Set([...(organizerId ? [organizerId] : []), ...organizerIds])
    );

    if (!targetIds.length || targetIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
      return NextResponse.json(
        { success: false, message: 'Provide valid organizer account IDs.' },
        { status: 400 }
      );
    }

    await connect();
    const organizers = await Organizer.find({ _id: { $in: targetIds } })
      .select('_id email')
      .lean();
    if (!organizers.length) {
      return NextResponse.json(
        { success: false, message: 'No matching organizer accounts were found.' },
        { status: 404 }
      );
    }

    const organizerEmails = organizers
      .map((organizer) => String(organizer.email || '').trim().toLowerCase())
      .filter(Boolean);
    await Promise.all([
      Organizer.deleteMany({ _id: { $in: organizers.map((item) => item._id) } }),
      User.deleteMany({ email: { $in: organizerEmails }, role: 'organizer' }),
    ]);

    return NextResponse.json({
      success: true,
      deletedCount: organizers.length,
      message:
        organizers.length === 1
          ? 'Organizer account deleted. Events and payment history were retained.'
          : `${organizers.length} organizer accounts deleted. Events and payment history were retained.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to delete organizer accounts.',
      },
      { status: 500 }
    );
  }
}
