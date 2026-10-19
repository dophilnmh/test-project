import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import User from '@/app/models/User';
import { auth } from '@/app/auth';
import { sendMailSafe } from '@/lib/mailer';

const ALLOWED_ROLES = ['admin', 'finance', 'superadmin'];

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

    const users = await User.find({
      role: { $in: ['superadmin', ...ALLOWED_ROLES] },
    })
      .sort({ createdAt: -1 })
      .select(
        'name firstName lastName email role status notificationPhone createdAt registeredByAdmin'
      )
      .lean();

    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load users' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
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
            'First name, last name, email, password and a valid access level are required',
        },
        { status: 400 }
      );
    }

    if (role === 'superadmin' && session.user.role !== 'superadmin') {
      return NextResponse.json(
        {
          success: false,
          message: 'Only the superadmin can create another superadmin.',
        },
        { status: 403 }
      );
    }

    await connect();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'A user already exists with this email' },
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

    const mailResult = await sendMailSafe({
      to: user.email,
      subject: 'Your NimblyPolls staff account has been created',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
          <h2>Hello ${user.firstName},</h2>
          <p>A ${role} account has been created for you on NimblyPolls.</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Access level:</strong> ${role}</p>
          <p>Please use the credentials shared by the superadmin to sign in.</p>
        </div>
      `,
      text: `Hello ${user.firstName}, a ${role} account has been created for you on NimblyPolls. Email: ${user.email}.`,
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      mailSent: Boolean(mailResult?.ok),
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to create user' },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const userId = String(body?.userId || '').trim();
    const status = String(body?.status || '')
      .trim()
      .toLowerCase();

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !['active', 'suspended'].includes(status)
    ) {
      return NextResponse.json(
        { success: false, message: 'A valid user and status are required' },
        { status: 400 }
      );
    }

    if (String(session.user.id) === userId) {
      return NextResponse.json(
        {
          success: false,
          message: 'You cannot change your own account status',
        },
        { status: 400 }
      );
    }

    await connect();

    const user = await User.findOneAndUpdate(
      { _id: userId, role: { $in: ALLOWED_ROLES } },
      { $set: { status: status === 'suspended' ? 'Suspended' : 'Active' } },
      { new: true }
    )
      .select('name firstName lastName email role status')
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Managed user not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${status === 'suspended' ? 'suspended' : 'restored'} successfully`,
      user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update user status',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    if (!ensureSuperadmin(session)) {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const userId = String(body?.userId || '').trim();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: 'A valid user is required' },
        { status: 400 }
      );
    }

    if (String(session.user.id) === userId) {
      return NextResponse.json(
        { success: false, message: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    await connect();
    const deletedUser = await User.findOneAndDelete({
      _id: userId,
      role: { $in: ALLOWED_ROLES },
    })
      .select('email')
      .lean();

    if (!deletedUser) {
      return NextResponse.json(
        { success: false, message: 'Managed user not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to delete user' },
      { status: 500 }
    );
  }
}
