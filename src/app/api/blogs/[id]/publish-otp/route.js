import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import BlogPost from '@/app/models/BlogPost';
import BlogPublishOtp from '@/app/models/BlogPublishOtp';
import { sendMailSafe } from '@/lib/mailer';

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

    if (String(session.user.role || '').toLowerCase() !== 'superadmin') {
      return NextResponse.json(
        { success: false, message: 'Superadmin access required' },
        { status: 403 }
      );
    }

    const params = await context?.params;
    const id = params?.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid blog post id' },
        { status: 400 }
      );
    }

    await connect();

    const post = await BlogPost.findById(id).select('title status').lean();
    if (!post) {
      return NextResponse.json(
        { success: false, message: 'Blog post not found' },
        { status: 404 }
      );
    }

    const otp = String(randomInt(100000, 1000000));
    const email = String(session.user.email || '')
      .trim()
      .toLowerCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await BlogPublishOtp.findOneAndUpdate(
      {
        postId: id,
        email,
      },
      {
        postId: id,
        email,
        codeHash: hashCode(otp),
        expiresAt,
        usedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mail = await sendMailSafe({
      to: email,
      subject: `Blog publish OTP: ${post.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
          <h2>Blog Publish OTP</h2>
          <p>Use this OTP to approve publishing your blog post.</p>
          <p><strong>Post:</strong> ${post.title}</p>
          <p><strong>OTP:</strong> ${otp}</p>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
      text: `Blog publish OTP for ${post.title}: ${otp}. Expires in 10 minutes.`,
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
