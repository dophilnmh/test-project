import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import connect from '@/app/utils/db';
import User from '@/app/models/User';
import Organizer from '@/app/models/Organizer';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, otp, password, confirmPassword } = await request.json();
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !otp || !password || !confirmPassword) {
      return NextResponse.json(
        {
          message: 'Email, OTP, password, and confirm password are required.',
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    await connect();

    const otpHash = crypto
      .createHash('sha256')
      .update(String(otp))
      .digest('hex');
    const filter = {
      email: normalizedEmail,
      resetPasswordToken: otpHash,
      resetPasswordExpires: { $gt: new Date() },
    };

    const account =
      (await User.findOne(filter)) || (await Organizer.findOne(filter));

    if (!account) {
      return NextResponse.json(
        { message: 'OTP is invalid or has expired.' },
        { status: 400 }
      );
    }

    account.password = await bcrypt.hash(password, 12);
    account.resetPasswordToken = null;
    account.resetPasswordExpires = null;
    await account.save();

    return NextResponse.json({
      ok: true,
      message: 'Password reset successful. You can now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
