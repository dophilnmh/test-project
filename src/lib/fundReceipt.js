import { jsPDF } from 'jspdf';
import { formatKsh } from './currency';

export function createFundReceiptPdf(request) {
  const doc = new jsPDF();
  const receiptNumber =
    String(request._id || '')
      .slice(-8)
      .toUpperCase() || 'N/A';
  const approvedAt = request.emailApprovalCompletedAt || request.updatedAt;

  doc.setFontSize(20);
  doc.text('NimblyPolls', 20, 24);
  doc.setFontSize(15);
  doc.text('Fund Approval Receipt', 20, 36);
  doc.setDrawColor(210, 210, 210);
  doc.line(20, 42, 190, 42);

  doc.setFontSize(11);
  const rows = [
    ['Receipt number', receiptNumber],
    ['Organizer', String(request.organizerName || '-')],
    ['Email', String(request.organizerEmail || '-')],
    ['M-PESA number', String(request.mpesaNumber || '-')],
    ['Account name', String(request.accountName || '-')],
    ['Amount', formatKsh(Number(request.amount || 0))],
    ['Purpose', String(request.requestPurpose || '-')],
    ['Status', 'APPROVED'],
    ['Approved on', approvedAt ? new Date(approvedAt).toLocaleString() : '-'],
  ];

  let y = 56;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value).slice(0, 90), 65, y);
    y += 10;
  });

  doc.setDrawColor(210, 210, 210);
  doc.line(20, y + 2, 190, y + 2);
  doc.setFontSize(9);
  doc.text('This receipt confirms approval for payout processing.', 20, y + 14);

  return Buffer.from(doc.output('arraybuffer'));
}
