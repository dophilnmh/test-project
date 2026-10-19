import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import BlogPost from '@/app/models/BlogPost';
import BlogPublishOtp from '@/app/models/BlogPublishOtp';
import { sendMailSafe } from '@/lib/mailer';

function sanitizeHtml(html) {
  const input = String(html || '');
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function parseTags(rawTags) {
  if (!rawTags) return undefined;
  if (Array.isArray(rawTags)) {
    return rawTags.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(rawTags)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashCode(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

export async function GET(_, { params }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid blog post id' },
        { status: 400 }
      );
    }

    await connect();

    const post = await BlogPost.findById(id).lean();
    if (!post) {
      return NextResponse.json(
        { success: false, message: 'Post not found' },
        { status: 404 }
      );
    }

    if (post.status !== 'published') {
      const session = await auth();
      const role = session?.user?.role;
      if (role !== 'admin' && role !== 'superadmin') {
        return NextResponse.json(
          { success: false, message: 'Post is not publicly available' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, post });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load blog post' },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
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
        { success: false, message: 'Only admins can update blog posts' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid blog post id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updates = {};

    if (body.title !== undefined)
      updates.title = String(body.title || '').trim();
    if (body.excerpt !== undefined)
      updates.excerpt = String(body.excerpt || '').trim();
    if (body.content !== undefined)
      updates.content = sanitizeHtml(body.content).trim();
    if (body.coverImageUrl !== undefined)
      updates.coverImageUrl = String(body.coverImageUrl || '').trim();
    if (body.category !== undefined)
      updates.category = String(body.category || 'General').trim();
    if (body.authorName !== undefined)
      updates.authorName = String(body.authorName || '').trim();
    if (body.readMinutes !== undefined)
      updates.readMinutes = Math.max(
        1,
        Math.floor(Number(body.readMinutes || 1))
      );

    const tags = parseTags(body.tags);
    if (tags !== undefined) updates.tags = tags;

    if (body.status !== undefined) {
      const status = String(body.status || '').trim();
      const allowed = [
        'draft',
        'pending_approval',
        'published',
        'rejected',
        'archived',
      ];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { success: false, message: 'Invalid blog status' },
          { status: 400 }
        );
      }

      if (status === 'published') {
        if (role !== 'superadmin') {
          return NextResponse.json(
            {
              success: false,
              message: 'Only superadmin can publish blog posts',
            },
            { status: 403 }
          );
        }

        const otp = String(body?.otp || '').trim();
        if (!otp) {
          return NextResponse.json(
            {
              success: false,
              message: 'OTP is required before publishing',
            },
            { status: 400 }
          );
        }

        await connect();
        const email = String(session.user.email || '')
          .trim()
          .toLowerCase();
        const otpRecord = await BlogPublishOtp.findOne({
          postId: id,
          email,
          usedAt: null,
          expiresAt: { $gt: new Date() },
        });

        if (!otpRecord || otpRecord.codeHash !== hashCode(otp)) {
          return NextResponse.json(
            { success: false, message: 'Invalid or expired OTP' },
            { status: 400 }
          );
        }

        otpRecord.usedAt = new Date();
        await otpRecord.save();
        updates.approvedByEmail = email;
        updates.approvedAt = new Date();
        updates.rejectionReason = '';
      }

      if (status === 'rejected') {
        const reason = String(body?.rejectionReason || '').trim();
        if (!reason) {
          return NextResponse.json(
            { success: false, message: 'Rejection reason is required' },
            { status: 400 }
          );
        }
        updates.rejectionReason = reason;
        updates.approvedByEmail = '';
        updates.approvedAt = null;
      }

      if (status === 'pending_approval' || status === 'draft') {
        updates.rejectionReason = '';
      }

      updates.status = status;
      updates.publishedAt = status === 'published' ? new Date() : null;
    }

    await connect();

    const post = await BlogPost.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();
    if (!post) {
      return NextResponse.json(
        { success: false, message: 'Post not found' },
        { status: 404 }
      );
    }

    if (body.status !== undefined && post.createdByEmail) {
      const nextStatus = String(post.status || '').trim();
      if (['published', 'rejected'].includes(nextStatus)) {
        await sendMailSafe({
          to: post.createdByEmail,
          subject:
            nextStatus === 'published'
              ? 'Blog post approved and published'
              : 'Blog post rejected',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
              <h2>Blog Post ${nextStatus === 'published' ? 'Approved' : 'Rejected'}</h2>
              <p><strong>Title:</strong> ${post.title}</p>
              <p><strong>Status:</strong> ${post.status}</p>
              ${post.rejectionReason ? `<p><strong>Reason:</strong> ${post.rejectionReason}</p>` : ''}
            </div>
          `,
          text: `Blog post "${post.title}" is now ${post.status}.${post.rejectionReason ? ` Reason: ${post.rejectionReason}.` : ''}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Blog post updated',
      post,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to update blog post',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
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

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid blog post id' },
        { status: 400 }
      );
    }

    await connect();

    const removed = await BlogPost.findByIdAndDelete(id).lean();
    if (!removed) {
      return NextResponse.json(
        { success: false, message: 'Post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Blog post deleted',
      post: removed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to delete blog post',
      },
      { status: 500 }
    );
  }
}
