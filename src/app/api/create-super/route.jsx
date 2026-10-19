import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import connect from '@/app/utils/db';
import User from '@/app/models/User';

const getExpectedSecret = () =>
  String(
    process.env.SUPERADMIN_SECRET_WORD ||
      process.env.ADMIN_CREATION_SECRET ||
      ''
  ).trim();

function resolveName(body) {
  const firstName = String(body?.firstName || '').trim();
  const lastName = String(body?.lastName || '').trim();
  const providedName = String(body?.name || '').trim();

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return providedName;
}

async function ensureSecret(secret) {
  const expectedSecret = getExpectedSecret();

  if (!expectedSecret) {
    return NextResponse.json(
      {
        success: false,
        message: 'SUPERADMIN_SECRET_WORD is not configured.',
      },
      { status: 500 }
    );
  }

  if (String(secret || '').trim() !== expectedSecret) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid secret word.',
      },
      { status: 401 }
    );
  }

  return null;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const authError = await ensureSecret(body?.secret);
    if (authError) {
      return authError;
    }

    await connect();

    const existingSuperadmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperadmin) {
      return NextResponse.json(
        {
          success: false,
          message: 'A superadmin already exists. Use update instead.',
        },
        { status: 409 }
      );
    }

    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const name = resolveName(body) || 'Super Admin';
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(body?.password || '').trim();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email and password are required to create the superadmin.',
        },
        { status: 400 }
      );
    }

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
    const superadmin = await User.create({
      firstName: firstName || name,
      lastName: lastName || '',
      name,
      email,
      password: hashedPassword,
      role: 'superadmin',
      status: 'Active',
      registeredByAdmin: true,
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Superadmin created successfully.',
        user: {
          id: String(superadmin._id),
          name: superadmin.name,
          email: superadmin.email,
          role: superadmin.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to create superadmin.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const authError = await ensureSecret(body?.secret);
    if (authError) {
      return authError;
    }

    await connect();

    const superadmin = await User.findOne({ role: 'superadmin' });
    if (!superadmin) {
      return NextResponse.json(
        {
          success: false,
          message: 'No superadmin exists yet. Create one first.',
        },
        { status: 404 }
      );
    }

    const newName = resolveName(body);
    const newEmail = String(body?.email || '')
      .trim()
      .toLowerCase();
    const newPassword = String(body?.password || '').trim();

    if (newEmail && newEmail !== String(superadmin.email).toLowerCase()) {
      const duplicate = await User.findOne({ email: newEmail });
      if (duplicate && String(duplicate._id) !== String(superadmin._id)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Another user already exists with this email address.',
          },
          { status: 409 }
        );
      }
    }

    if (newName) {
      superadmin.name = newName;
    }
    if (newEmail) {
      superadmin.email = newEmail;
    }
    if (newPassword) {
      superadmin.password = await bcrypt.hash(newPassword, 10);
    }
    superadmin.role = 'superadmin';
    superadmin.status = superadmin.status || 'Active';
    await superadmin.save();

    return NextResponse.json({
      success: true,
      message: 'Superadmin updated successfully.',
      user: {
        id: String(superadmin._id),
        name: superadmin.name,
        email: superadmin.email,
        role: superadmin.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update superadmin.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const authError = await ensureSecret(body?.secret);
    if (authError) {
      return authError;
    }

    await connect();

    const targetEmail = String(body?.email || '')
      .trim()
      .toLowerCase();
    const target = targetEmail
      ? await User.findOne({ email: targetEmail, role: 'superadmin' })
      : await User.findOne({ role: 'superadmin' });

    if (!target) {
      return NextResponse.json(
        {
          success: false,
          message: 'No superadmin found to delete.',
        },
        { status: 404 }
      );
    }

    await User.findByIdAndDelete(target._id);

    return NextResponse.json({
      success: true,
      message: 'Superadmin deleted successfully.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to delete superadmin.',
      },
      { status: 500 }
    );
  }
}
