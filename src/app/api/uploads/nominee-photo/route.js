import { NextResponse } from 'next/server';
import cloudinary from '@/app/config/cloudinary';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'Contestant photo file is required' },
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

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    const uploaded = await cloudinary.v2.uploader.upload(dataUri, {
      folder: 'nimblypolls/contestants/self-registered',
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
      message: 'Contestant photo uploaded successfully',
      imageUrl: uploaded.secure_url,
      profileImageUrl: uploaded.secure_url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to upload contestant photo',
      },
      { status: 500 }
    );
  }
}
