import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

function digitsOnly(value) {
  return String(value || '').replace(/\D+/g, '');
}

export function maskPhone(phone) {
  const normalized = digitsOnly(phone);
  if (normalized.length < 4) return String(phone || '');
  return `${normalized.slice(0, 3)}****${normalized.slice(-3)}`;
}

export function createTicketCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const nonce = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `NTP-${stamp}-${nonce}`;
}

export function createEntryCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function buildTicketQrPayload({ ticketCode, entryCode }) {
  return `NIMBLYTICKET:${String(ticketCode || '').trim()}:${String(entryCode || '').trim()}`;
}

export async function buildTicketPdfBuffer({
  order,
  event,
  issuedAt = new Date(),
  customerEmail,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const margin = 48;
  let y = 72;

  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageWidth, 120, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('NimblyPolls Ticket', margin, 62);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Issued: ${issuedAt.toISOString()}`, margin, 86);

  y = 160;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(
    String(event?.title || order?.eventTitle || 'Event Ticket'),
    margin,
    y
  );

  y += 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const lines = [
    `Ticket Code: ${order.ticketCode}`,
    `Entry Code (SMS): ${order.entryCode}`,
    `Tier: ${order.tierName}`,
    `Quantity: ${order.quantity}`,
    `Amount Paid: KES ${Number(order.totalAmount || 0).toLocaleString()}`,
    `M-Pesa Receipt: ${order.mpesaReceiptNumber || '-'}`,
    `Phone: ${maskPhone(order.customerPhone)}`,
    `Email: ${customerEmail || '-'}`,
  ];

  for (const line of lines) {
    doc.text(line, margin, y);
    y += 24;
  }

  y += 10;
  doc.setDrawColor(209, 213, 219);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.text('Entry Verification Instructions', margin, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Present this PDF and your SMS Entry Code to the event organizer for check-in.',
    margin,
    y
  );

  y += 20;
  doc.text(
    'Each ticket code can be verified once unless the organizer performs manual override.',
    margin,
    y
  );

  const qrPayload = buildTicketQrPayload({
    ticketCode: order.ticketCode,
    entryCode: order.entryCode,
  });

  const qrImageDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 220,
    margin: 1,
  });

  const qrSize = 128;
  doc.addImage(
    qrImageDataUrl,
    'PNG',
    pageWidth - margin - qrSize,
    150,
    qrSize,
    qrSize
  );

  doc.setFontSize(10);
  doc.text('Scan for gate check-in', pageWidth - margin - qrSize, 292);

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
