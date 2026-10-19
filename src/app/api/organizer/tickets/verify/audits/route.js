import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import connect from '@/app/utils/db';
import Organizer from '@/app/models/Organizer';
import TicketVerificationAudit from '@/app/models/TicketVerificationAudit';

export const runtime = 'nodejs';

const ALLOWED_OUTCOMES = new Set([
  'missing_fields',
  'invalid_ticket',
  'already_used',
  'verified',
]);

function normalizePage(value) {
  const parsed = Number.parseInt(String(value || '1'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || '50'), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 200);
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeExportFormat(value) {
  const format = String(value || '')
    .trim()
    .toLowerCase();
  if (format === 'csv' || format === 'pdf') return format;
  return 'json';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter({ organizerId, outcome, verifier, ticketCode, from, to }) {
  const filter = { organizerId };

  if (outcome && ALLOWED_OUTCOMES.has(outcome)) {
    filter.outcome = outcome;
  }

  if (verifier) {
    filter.verifier = {
      $regex: new RegExp(escapeRegex(verifier), 'i'),
    };
  }

  if (ticketCode) {
    filter.ticketCode = {
      $regex: new RegExp(escapeRegex(ticketCode.toUpperCase()), 'i'),
    };
  }

  if (from || to) {
    filter.checkedAt = {};
    if (from) filter.checkedAt.$gte = from;
    if (to) filter.checkedAt.$lte = to;
  }

  return filter;
}

function mapAudit(item) {
  return {
    id: String(item._id || ''),
    organizerId: String(item.organizerId || ''),
    verifier: String(item.verifier || ''),
    ticketCode: String(item.ticketCode || ''),
    outcome: String(item.outcome || ''),
    checkedAt: item.checkedAt || null,
    eventTitle: String(item.eventTitle || ''),
    tierName: String(item.tierName || ''),
    quantity: Number(item.quantity || 0),
    message: String(item.message || ''),
    requestSource: String(item.requestSource || 'unknown'),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function formatOutcome(outcome) {
  const value = String(outcome || '').trim();
  if (!value) return 'unknown';
  return value.replaceAll('_', ' ');
}

function toCsvCell(value) {
  const text = String(value ?? '');
  if (/[,"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function buildCsv(items) {
  const headers = [
    'checkedAt',
    'outcome',
    'ticketCode',
    'verifier',
    'eventTitle',
    'tierName',
    'quantity',
    'requestSource',
    'message',
  ];

  const rows = items.map((item) => [
    item.checkedAt ? new Date(item.checkedAt).toISOString() : '',
    formatOutcome(item.outcome),
    String(item.ticketCode || ''),
    String(item.verifier || ''),
    String(item.eventTitle || ''),
    String(item.tierName || ''),
    String(Number(item.quantity || 0)),
    String(item.requestSource || ''),
    String(item.message || ''),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\n');
}

async function buildPdfBuffer({ items, organizerName, filters }) {
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const lineHeight = 14;
  let y = margin;

  const drawHeader = () => {
    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Ticket Verification Dispute Pack', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Organizer: ${organizerName}`, margin, y);
    y += 12;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 12;
    doc.text(
      `Filters - Outcome: ${filters.outcome || 'all'} | Verifier: ${filters.verifier || 'all'} | Ticket: ${filters.ticketCode || 'all'}`,
      margin,
      y
    );
    y += 12;
    doc.text(
      `From: ${filters.from || 'n/a'} | To: ${filters.to || 'n/a'} | Records: ${items.length}`,
      margin,
      y
    );
    y += 16;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
  };

  drawHeader();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const lines = [
      `${index + 1}. ${new Date(item.checkedAt || Date.now()).toLocaleString()} | ${formatOutcome(item.outcome).toUpperCase()} | ${item.ticketCode || '-'}`,
      `Verifier: ${item.verifier || '-'} | Source: ${item.requestSource || '-'} | Qty: ${Number(item.quantity || 0)}`,
      `Event: ${item.eventTitle || '-'} | Tier: ${item.tierName || '-'}`,
      `Message: ${item.message || '-'}`,
    ];

    const estimatedHeight = lines.length * lineHeight + 8;
    if (y + estimatedHeight > pageHeight - margin) {
      doc.addPage();
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }

    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
      for (const wrappedLine of wrapped) {
        doc.text(wrappedLine, margin, y);
        y += lineHeight;
      }
    }
    y += 8;
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    await connect();

    const organizer = await Organizer.findOne({
      email: String(session.user.email).toLowerCase(),
    }).lean();

    if (!organizer) {
      return NextResponse.json(
        { success: false, message: 'Organizer account not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = normalizeExportFormat(searchParams.get('format'));
    const page = normalizePage(searchParams.get('page'));
    const limit = normalizeLimit(searchParams.get('limit'));
    const outcome = String(searchParams.get('outcome') || '')
      .trim()
      .toLowerCase();
    const verifier = String(searchParams.get('verifier') || '')
      .trim()
      .toLowerCase();
    const ticketCode = String(searchParams.get('ticketCode') || '').trim();
    const from = normalizeDate(searchParams.get('from'));
    const to = normalizeDate(searchParams.get('to'));

    const filter = buildFilter({
      organizerId: organizer._id,
      outcome,
      verifier,
      ticketCode,
      from,
      to,
    });

    if (format === 'csv' || format === 'pdf') {
      const exportLimit = Math.max(limit, 2000);
      const items = await TicketVerificationAudit.find(filter)
        .sort({ checkedAt: -1 })
        .limit(exportLimit)
        .lean();

      const mapped = items.map(mapAudit);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (format === 'csv') {
        const csv = buildCsv(mapped);
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="ticket-verification-audits-${stamp}.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      const pdfBuffer = await buildPdfBuffer({
        items: mapped,
        organizerName: String(organizer.organizationName || organizer.email),
        filters: {
          outcome: ALLOWED_OUTCOMES.has(outcome) ? outcome : '',
          verifier,
          ticketCode,
          from: from ? from.toISOString() : '',
          to: to ? to.toISOString() : '',
        },
      });

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ticket-verification-audits-${stamp}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      TicketVerificationAudit.find(filter)
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TicketVerificationAudit.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      items: items.map(mapAudit),
      filters: {
        outcome: ALLOWED_OUTCOMES.has(outcome) ? outcome : '',
        verifier,
        ticketCode,
        from: from ? from.toISOString() : '',
        to: to ? to.toISOString() : '',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Unable to load ticket verification audits',
      },
      { status: 500 }
    );
  }
}
