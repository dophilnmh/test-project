import mongoose from 'mongoose';
import Event from '@/app/models/Event';
import { NextResponse } from 'next/server';
import connect from '@/app/utils/db';
import { auth } from '@/app/auth';
import MerchProduct from '@/app/models/MerchProduct';
import Organizer from '@/app/models/Organizer';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req) {
  try {
    const scope = req.nextUrl.searchParams.get('scope');
    const isAdminScope = scope === 'admin';
    const isOrganizerScope = scope === 'organizer';

    if (isAdminScope || isOrganizerScope) {
      const session = await auth();
      const role = session?.user?.role;
      const isAdmin = role === 'admin' || role === 'superadmin';
      const isOrganizer = role === 'organizer';
      if (!isAdmin && !(isOrganizerScope && isOrganizer)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Not authorized to access this product scope',
          },
          { status: 403 }
        );
      }

      await connect();

      if (isOrganizerScope && isOrganizer) {
        const organizer = await Organizer.findOne({
          email: String(session?.user?.email || '')
            .trim()
            .toLowerCase(),
        })
          .select('_id')
          .lean();

        if (!organizer?._id) {
          return NextResponse.json({ success: true, products: [] });
        }

        const products = await MerchProduct.find({ organizerId: organizer._id })
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json({ success: true, products });
      }

      const products = await MerchProduct.find({})
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({ success: true, products });
    }

    await connect();

    const organizerId = req.nextUrl.searchParams.get('organizerId');
    let organizerName = '';
    if (organizerId) {
      if (!mongoose.Types.ObjectId.isValid(organizerId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid shop link' },
          { status: 400 }
        );
      }

      const organizer = await Organizer.findById(organizerId)
        .select('organizationName')
        .lean();
      if (!organizer) {
        return NextResponse.json(
          { success: false, message: 'Shop not found' },
          { status: 404 }
        );
      }
      organizerName = organizer.organizationName || '';
    }

    const filter = {
      status: 'active',
      approvalStatus: 'approved',
      stock: { $gt: 0 },
      ...(organizerId ? { organizerId } : {}),
    };

    const products = await MerchProduct.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, products, organizerName });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load merchandise products',
      },
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

    const role = String(session.user.role || '').toLowerCase();
    if (!['organizer', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only organizers and admins can create products',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();
    const category = String(body?.category || 'General').trim();
    const rawImageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls
      : String(body?.imageUrl || '').trim()
        ? [String(body.imageUrl).trim()]
        : [];
    const imageUrls = rawImageUrls
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    const price = Math.max(0, toNumber(body?.price));
    const stock = Math.max(0, Math.floor(toNumber(body?.stock)));
    const requestedStatus = String(body?.status || '').trim();
    const eventId = String(body?.eventId || '').trim();

    if (!name || !description) {
      return NextResponse.json(
        { success: false, message: 'Name and description are required' },
        { status: 400 }
      );
    }

    const allowedStatuses = ['draft', 'active', 'out_of_stock', 'archived'];
    const status = allowedStatuses.includes(requestedStatus)
      ? requestedStatus
      : stock > 0
        ? 'active'
        : 'out_of_stock';

    await connect();

    let organizerId = null;
    let organizerName = '';
    if (role === 'organizer') {
      const organizer = await Organizer.findOne({
        email: String(session.user.email || '')
          .trim()
          .toLowerCase(),
      })
        .select('_id organizationName')
        .lean();
      if (!organizer?._id) {
        return NextResponse.json(
          { success: false, message: 'Organizer account not found' },
          { status: 404 }
        );
      }
      organizerId = organizer._id;
      organizerName = String(organizer.organizationName || '').trim();
    }

    let event = null;
    if (eventId) {
      event = await Event.findOne({
        _id: eventId,
        ...(organizerId ? { organizerId } : {}),
        status: 'approved',
      })
        .select('_id')
        .lean();
      if (!event) {
        return NextResponse.json(
          {
            success: false,
            message: 'Select an approved event for this product',
          },
          { status: 400 }
        );
      }
    }

    const product = await MerchProduct.create({
      name,
      description,
      category,
      imageUrls,
      imageUrl: imageUrls[0] || '',
      price,
      stock,
      status,
      organizerId,
      organizerName,
      eventId: event?._id || null,
      approvalStatus: 'pending',
      createdByEmail: session.user.email || '',
    });

    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || 'Unable to create product' },
      { status: 500 }
    );
  }
}
