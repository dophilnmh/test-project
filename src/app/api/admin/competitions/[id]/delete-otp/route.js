import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import Event from '@/app/models/Event';
import CompetitionDeleteOtp from '@/app/models/CompetitionDeleteOtp';
import { sendMailSafe } from '@/lib/mailer';

function ensureSuperadmin(session) {
  return String(session?.user?.role || '').toLowerCase() === 'superadmin';
}

function hashCode(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

export async function POST(_req, context) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const params = await context?.params;
    const id = params?.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid competition id' },
        { status: 400 }
      );
    }

    await connect();

    const competition = await Event.findOne({
      _id: id,
      eventType: 'competition',
    })
      .select('title')
      .lean();

    if (!competition) {
      return NextResponse.json(
        { success: false, message: 'Competition not found' },
        { status: 404 }
      );
    }

    const email = String(session.user.email || '')
      .trim()
      .toLowerCase();
    const existingOtp = await CompetitionDeleteOtp.findOne({
      competitionId: id,
      email,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (existingOtp) {
      return NextResponse.json({
        success: true,
        message: 'The existing OTP is still valid for 30 minutes',
        expiresAt: existingOtp.expiresAt,
        reused: true,
      });
    }

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await CompetitionDeleteOtp.findOneAndUpdate(
      {
        competitionId: id,
        email,
      },
      {
        competitionId: id,
        email,
        codeHash: hashCode(otp),
        expiresAt,
        usedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mail = await sendMailSafe({
      to: email,
      subject: `Competition delete OTP: ${competition.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
          <h2>Competition Delete OTP</h2>
          <p>Use this OTP to confirm permanent deletion of a competition.</p>
          <p><strong>Competition:</strong> ${competition.title}</p>
          <p><strong>OTP:</strong> ${otp}</p>
          <p>This code expires in 30 minutes.</p>
        </div>
      `,
      text: `Competition delete OTP for ${competition.title}: ${otp}. Expires in 30 minutes.`,
    });

    if (!mail.ok) {
      return NextResponse.json(
        { success: false, message: mail.message || 'Unable to send OTP email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to superadmin email',
      expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to send OTP' },
      { status: 500 }
    );
  }
}
