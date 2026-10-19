import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import ContactMessage from '@/app/models/ContactMessage';

export async function PATCH(req, context) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can update messages' },
        { status: 403 }
      );
    }

    const params = await context?.params;
    const id = params?.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid message id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const status = String(body?.status || '').trim();
    const allowed = ['new', 'in_progress', 'resolved', 'archived'];

    if (!allowed.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid contact status' },
        { status: 400 }
      );
    }

    await connect();

    const updates = {
      status,
      repliedAt: status === 'resolved' ? new Date() : null,
    };

    const message = await ContactMessage.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    if (!message) {
      return NextResponse.json(
        { success: false, message: 'Contact message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contact message updated',
      contact: message,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update contact message',
      },
      { status: 500 }
    );
  }
}
