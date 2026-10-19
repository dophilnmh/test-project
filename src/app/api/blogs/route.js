import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import BlogPost from '@/app/models/BlogPost';

function sanitizeHtml(html) {
  const input = String(html || '');
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function parseTags(rawTags) {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) {
    return rawTags.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(rawTags)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(req) {
  try {
    const scope = req.nextUrl.searchParams.get('scope');
    const adminScope = scope === 'admin';

    if (adminScope) {
      const session = await auth();
      const role = session?.user?.role;
      if (role !== 'admin' && role !== 'superadmin') {
        return NextResponse.json(
          { success: false, message: 'Only admins can view all blog posts' },
          { status: 403 }
        );
      }
    }

    await connect();

    const filter = adminScope ? {} : { status: 'published' };
    const posts = await BlogPost.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, posts });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to load blog posts' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
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
        { success: false, message: 'Only admins can create blog posts' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const title = String(body?.title || '').trim();
    const excerpt = String(body?.excerpt || '').trim();
    const content = sanitizeHtml(body?.content).trim();
    const coverImageUrl = String(body?.coverImageUrl || '').trim();
    const category = String(body?.category || 'General').trim();
    const authorName = String(
      body?.authorName || session.user.name || 'NimblyPolls Team'
    ).trim();
    const readMinutes = Math.max(1, Math.floor(Number(body?.readMinutes || 3)));
    const requestedStatus = String(body?.status || 'pending_approval').trim();
    const tags = parseTags(body?.tags);

    if (!title || !excerpt || !content) {
      return NextResponse.json(
        { success: false, message: 'Title, excerpt, and content are required' },
        { status: 400 }
      );
    }

    const allowedStatuses = [
      'draft',
      'pending_approval',
      'published',
      'rejected',
      'archived',
    ];
    if (!allowedStatuses.includes(requestedStatus)) {
      return NextResponse.json(
        { success: false, message: 'Invalid blog status' },
        { status: 400 }
      );
    }

    let status = requestedStatus;
    if (requestedStatus === 'published') {
      status = 'pending_approval';
    }

    await connect();

    const post = await BlogPost.create({
      title,
      excerpt,
      content,
      coverImageUrl,
      category,
      tags,
      authorName,
      readMinutes,
      status,
      publishedAt: status === 'published' ? new Date() : null,
      createdByEmail: session.user.email || '',
    });

    return NextResponse.json({
      success: true,
      message:
        post.status === 'draft'
          ? 'Blog post saved as draft'
          : 'Blog post submitted and pending approval',
      post,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to create blog post',
      },
      { status: 500 }
    );
  }
}
