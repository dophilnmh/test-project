import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import cloudinary from '@/app/config/cloudinary';
import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
    if (!['organizer', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only event admins can upload contestant images',
        },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'Contestant image file is required' },
        { status: 400 }
      );
    }

    if (!String(file.type || '').startsWith('image/')) {
      return NextResponse.json(
        { success: false, message: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'Image must be 5MB or less' },
        { status: 400 }
      );
    }

    let organizerSlug = 'general';
    try {
      await connect();
      const organizer = await Organizer.findOne({
        email: session.user.email,
      }).lean();
      if (organizer?.organizationName) {
        organizerSlug = slugify(organizer.organizationName) || 'general';
      } else if (session.user.name) {
        organizerSlug = slugify(session.user.name) || 'general';
      }
    } catch {
      organizerSlug =
        slugify(session.user.name || session.user.email || 'general') ||
        'general';
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    const uploaded = await cloudinary.v2.uploader.upload(dataUri, {
      folder: `nimblypolls/contestants/${organizerSlug}`,
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
      transformation: [
        {
          width: MAX_IMAGE_WIDTH,
          height: MAX_IMAGE_HEIGHT,
          crop: 'limit',
          fetch_format: 'auto',
          quality: 'auto',
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Contestant image uploaded successfully',
      imageUrl: uploaded.secure_url,
      profileImageUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      folder: uploaded.folder,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      bytes: uploaded.bytes,
      maxWidth: MAX_IMAGE_WIDTH,
      maxHeight: MAX_IMAGE_HEIGHT,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Contestant image upload failed',
      },
      { status: 500 }
    );
  }
}
