import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import connect from '@/app/utils/db';
import User from '@/app/models/User';

const ALLOWED_ROLES = ['admin', 'finance'];

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const providedSecret = String(body?.secret || '').trim();
    const expectedSecret = String(
      process.env.ADMIN_CREATION_SECRET || ''
    ).trim();

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: 'Invalid admin creation secret.' },
        { status: 401 }
      );
    }

    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(body?.password || '');
    const role = String(body?.role || '')
      .trim()
      .toLowerCase();
    const phone = String(body?.phone || '').trim();

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !ALLOWED_ROLES.includes(role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'First name, last name, email, password, and a valid role are required.',
        },
        { status: 400 }
      );
    }

    await connect();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'A user already exists with this email address.',
        },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email,
      password: hashedPassword,
      role,
      phone,
      status: 'Active',
      registeredByAdmin: true,
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      notificationPhone: phone,
    });

    return NextResponse.json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully.`,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to create admin account.',
      },
      { status: 500 }
    );
  }
}
