import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import User from '@/app/models/User';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';

function ensureSuperadmin(session) {
  return session?.user?.role === 'superadmin';
}

export async function GET() {
  try {
    const session = await auth();
    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    await connect();

    const user = await User.findOne({
      email: String(session.user.email).toLowerCase(),
    }).lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        name:
          user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        notificationPhone: user.notificationPhone || user.phone || '',
        notificationEmailEnabled: user.notificationEmailEnabled !== false,
        notificationSmsEnabled: Boolean(user.notificationSmsEnabled),
        merchandiseCommissionPercent: Number(
          user.merchandiseCommissionPercent ?? 15
        ),
        votingCommissionPercent: Number(user.votingCommissionPercent ?? 20),
      },
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
    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const notificationPhone = String(body?.notificationPhone || '').trim();
    const notificationEmailEnabled = body?.notificationEmailEnabled !== false;
    const notificationSmsEnabled = Boolean(body?.notificationSmsEnabled);
    const merchandiseCommissionPercent = Math.max(
      0,
      Math.min(100, Number(body?.merchandiseCommissionPercent ?? 15))
    );
    const votingCommissionPercent = Math.max(
      0,
      Math.min(100, Number(body?.votingCommissionPercent ?? 20))
    );

    await connect();

    const user = await User.findOneAndUpdate(
      { email: String(session.user.email).toLowerCase() },
      {
        $set: {
          notificationPhone,
          notificationEmailEnabled,
          notificationSmsEnabled,
          merchandiseCommissionPercent,
          votingCommissionPercent,
        },
      },
      { new: true }
    ).lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    const mailResult = await sendMailSafe({
      to: user.email,
      subject: 'Superadmin notification settings updated',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
          <h2>Notification Settings Updated</h2>
          <p>Your superadmin notification settings were updated successfully.</p>
          <p><strong>Notification phone:</strong> ${notificationPhone || '-'}</p>
          <p><strong>Email alerts:</strong> ${notificationEmailEnabled ? 'Enabled' : 'Disabled'}</p>
          <p><strong>SMS alerts:</strong> ${notificationSmsEnabled ? 'Enabled' : 'Disabled'}</p>
          <p><strong>Merch commission:</strong> ${merchandiseCommissionPercent}%</p>
          <p><strong>Voting commission:</strong> ${votingCommissionPercent}%</p>
        </div>
      `,
      text: `Superadmin settings updated. Phone: ${notificationPhone || '-'}. Email alerts: ${notificationEmailEnabled ? 'Enabled' : 'Disabled'}. SMS alerts: ${notificationSmsEnabled ? 'Enabled' : 'Disabled'}. Merch commission: ${merchandiseCommissionPercent}%. Voting commission: ${votingCommissionPercent}%.`,
    });

    return NextResponse.json({
      success: true,
      message: 'Superadmin settings updated',
      mailSent: Boolean(mailResult?.ok),
      profile: {
        name:
          user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        notificationPhone: user.notificationPhone || user.phone || '',
        notificationEmailEnabled: user.notificationEmailEnabled !== false,
        notificationSmsEnabled: Boolean(user.notificationSmsEnabled),
        merchandiseCommissionPercent: Number(
          user.merchandiseCommissionPercent ?? 15
        ),
        votingCommissionPercent: Number(user.votingCommissionPercent ?? 20),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to update settings' },
      { status: 500 }
    );
  }
}
