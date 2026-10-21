'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import {
  Check,
  Clock3,
  Copy,
  Download,
  Link2,
  Printer,
  ReceiptText,
  ShoppingBag,
  Ticket,
  Users,
} from 'lucide-react';
import { formatKsh } from '@/lib/currency';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('approvals');
  const [queue, setQueue] = useState([]);
  const [approvedEvents, setApprovedEvents] = useState([]);
  const [siteOrigin, setSiteOrigin] = useState('');
  const [publishedCount, setPublishedCount] = useState(0);
  const [fundRequests, setFundRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFunds, setLoadingFunds] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [actionEventId, setActionEventId] = useState('');
  const [commissionDrafts, setCommissionDrafts] = useState({});
  const [ticketEventSelections, setTicketEventSelections] = useState({});
  const [fundActionId, setFundActionId] = useState('');
  const [fundSearch, setFundSearch] = useState('');
  const [fundStatusFilter, setFundStatusFilter] = useState('all');
  const [fundPage, setFundPage] = useState(1);
  const [fundPageSize, setFundPageSize] = useState(10);
  const [otpDialog, setOtpDialog] = useState(null);
  const [fundOtp, setFundOtp] = useState('');
  const [verifyingFundOtp, setVerifyingFundOtp] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [ticketVerificationCode, setTicketVerificationCode] = useState('');
  const [ticketVerificationResult, setTicketVerificationResult] =
    useState(null);
  const [verifyingTicket, setVerifyingTicket] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dummyVoteRows, setDummyVoteRows] = useState([]);
  const [loadingDummyVotes, setLoadingDummyVotes] = useState(false);
  const [savingDummyKey, setSavingDummyKey] = useState('');
  const [dummyVoteDrafts, setDummyVoteDrafts] = useState({});
  const [savingDisplayTarget, setSavingDisplayTarget] = useState('');
  const [savingPublicDisplayTarget, setSavingPublicDisplayTarget] =
    useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [pendingResponse, publicResponse] = await Promise.all([
        fetch('/api/events/pending', { cache: 'no-store' }),
        fetch('/api/events?scope=all', { cache: 'no-store' }),
      ]);

      const pendingData = await pendingResponse.json();
      const publicData = await publicResponse.json();

      if (!pendingResponse.ok || !pendingData?.success) {
        setError(pendingData?.message || 'Unable to load pending queue');
        return;
      }

      if (!publicResponse.ok || !publicData?.success) {
        setError(publicData?.message || 'Unable to load published events');
        return;
      }

      setQueue(Array.isArray(pendingData.events) ? pendingData.events : []);
      setTicketEventSelections((previous) => {
        const next = { ...previous };
        (pendingData.events || []).forEach((event) => {
          next[event._id] =
            previous[event._id] ??
            String(event.competition?.ticketEventId || '');
        });
        return next;
      });
      setPublishedCount(
        Array.isArray(publicData.events) ? publicData.events.length : 0
      );
      setApprovedEvents(
        Array.isArray(publicData.events) ? publicData.events : []
      );
    } catch {
      setError('Unable to load admin dashboard right now.');
    } finally {
      setLoading(false);
    }
  };

  const loadFundRequests = async () => {
    setLoadingFunds(true);
    try {
      const response = await fetch('/api/admin/fund-requests', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (response.ok && data?.success) {
        setFundRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch {
      setFundRequests([]);
    } finally {
      setLoadingFunds(false);
    }
  };

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    loadDashboard();
    loadFundRequests();
  }, []);

  const loadDummyVotes = async () => {
    setLoadingDummyVotes(true);
    try {
      const response = await fetch('/api/admin/dummy-votes', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        return;
      }

      const rows = Array.isArray(data.rows) ? data.rows : [];
      setDummyVoteRows(rows);

      const nextDrafts = {};
      for (const row of rows) {
        const key = `${row.targetType}::${row.targetId}::${row.contestantKey}`;
        nextDrafts[key] = String(Math.max(0, Number(row.dummyVotes || 0)));
      }
      setDummyVoteDrafts(nextDrafts);
    } catch {
      // no-op
    } finally {
      setLoadingDummyVotes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dummy-votes') {
      loadDummyVotes();
    }
  }, [activeTab]);

  const totals = useMemo(() => {
    const pending = queue.length;
    const totalPotentialRevenue = queue.reduce((sum, item) => {
      const tiers = Array.isArray(item?.tiers) ? item.tiers : [];
      const eventValue = tiers.reduce(
        (tierSum, tier) => tierSum + Number(tier?.price || 0),
        0
      );
      return sum + eventValue;
    }, 0);

    return {
      pending,
      published: publishedCount,
      totalPotentialRevenue,
    };
  }, [queue, publishedCount]);

  const recordedContestants = useMemo(() => {
    if (!verificationResult) return [];

    return Array.from(
      new Set(
        (verificationResult.matches || [])
          .filter((match) => match.recorded)
          .map((match) => String(match.voteRecordedFor || '').trim())
          .filter(Boolean)
      )
    );
  }, [verificationResult]);

  const review = async (id, action) => {
    setFeedback('');
    setError('');
    const event = queue.find((item) => String(item._id) === String(id));
    const ticketEventId =
      ticketEventSelections[id] ||
      String(event?.competition?.ticketEventId || '');
    if (
      action === 'approve' &&
      event?.eventType === 'competition' &&
      !ticketEventId
    ) {
      setError('Select a ticketing event before approving this competition.');
      return;
    }
    setActionEventId(id);

    let rejectionReason = '';
    const draft = commissionDrafts[id] || {};
    if (action === 'reject') {
      rejectionReason = window.prompt('Enter rejection reason') || '';
      if (!rejectionReason.trim()) {
        setError('Rejection reason is required.');
        setActionEventId('');
        return;
      }
    }

    try {
      const response = await fetch(`/api/events/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason,
          ...draft,
          ...(action === 'approve' && event?.eventType === 'competition'
            ? { ticketEventId }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Action failed');
        return;
      }

      setFeedback(data.message || `Event ${action}d`);
      await loadDashboard();
    } catch {
      setError('Approval request failed. Please try again.');
    } finally {
      setActionEventId('');
    }
  };

  const getCommissionDraft = (event) =>
    commissionDrafts[event._id] || {
      ticketCommissionPercent:
        event.commercialTerms?.ticketCommissionPercent ?? 20,
      merchandiseCommissionPercent:
        event.commercialTerms?.merchandiseCommissionPercent ?? 15,
      votingCommissionPercent:
        event.commercialTerms?.votingCommissionPercent ?? 20,
    };

  const updateCommissionDraft = (event, key, value) => {
    setCommissionDrafts((prev) => ({
      ...prev,
      [event._id]: { ...getCommissionDraft(event), [key]: value },
    }));
  };

  const shareEventLink = async (event, kind) => {
    const eventId = encodeURIComponent(String(event?._id || ''));
    const path =
      kind === 'registration'
        ? `/nominee/register/${eventId}`
        : kind === 'ticket'
          ? `/events?eventId=${encodeURIComponent(String(event?._id || ''))}#event-${event?._id || ''}`
          : `/voting/${eventId}`;
    const url = `${window.location.origin}${path}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${event.title} ${kind === 'registration' ? 'contestant registration' : kind === 'ticket' ? 'ticket purchase' : 'voting'}`,
          url,
        });
        setFeedback('Event link shared successfully.');
      } else {
        await navigator.clipboard.writeText(url);
        setFeedback('Event link copied to the clipboard.');
      }
    } catch {
      setError('Unable to share or copy the event link.');
    }
  };

  const verifyVotes = async (event) => {
    event.preventDefault();
    setVerifying(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(
        `/api/admin/vote-verification?code=${encodeURIComponent(verificationCode)}`,
        { cache: 'no-store' }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to verify transaction');
        return;
      }

      setVerificationResult(data);
      setFeedback(
        data.recorded
          ? 'Transaction recorded successfully.'
          : 'Transaction not recorded.'
      );
    } catch {
      setError('Vote verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const verifyTicket = async (event) => {
    event.preventDefault();
    setVerifyingTicket(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(
        `/api/admin/ticket-verification?code=${encodeURIComponent(ticketVerificationCode)}`,
        { cache: 'no-store' }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to verify ticket transaction');
        return;
      }

      setTicketVerificationResult(data);
      setFeedback(
        data.recorded
          ? 'Ticket payment recorded successfully.'
          : 'Ticket payment not recorded.'
      );
    } catch {
      setError('Ticket verification failed. Please try again.');
    } finally {
      setVerifyingTicket(false);
    }
  };

  const saveDummyVotes = async (row) => {
    const rowKey = `${row.targetType}::${row.targetId}::${row.contestantKey}`;
    const value = Math.max(
      0,
      Math.round(Number(dummyVoteDrafts[rowKey] || row.dummyVotes || 0))
    );

    setSavingDummyKey(rowKey);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/admin/dummy-votes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: row.targetType,
          targetId: row.targetId,
          contestantKey: row.contestantKey,
          contestantName: row.contestantName,
          contestantCategory: row.contestantCategory,
          dummyVotes: value,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update dummy votes');
        return;
      }

      setFeedback(
        data.message ||
          'Dummy votes updated. Real votes and revenue remain unchanged.'
      );
      await loadDummyVotes();
    } catch {
      setError('Dummy vote update failed. Please try again.');
    } finally {
      setSavingDummyKey('');
    }
  };

  const groupedDummyVoteTargets = useMemo(() => {
    const groups = new Map();

    for (const row of dummyVoteRows) {
      const key = `${row.targetType}::${row.targetId}`;
      const draftKey = `${row.targetType}::${row.targetId}::${row.contestantKey}`;
      const draftDummyVotes = Math.max(
        0,
        Math.round(Number(dummyVoteDrafts[draftKey] ?? row.dummyVotes ?? 0))
      );
      const displayMode =
        row.voteDisplayMode === 'real_plus_dummy' ? 'real_plus_dummy' : 'real';
      const publicVoteDisplay =
        row.publicVoteDisplay === 'percent'
          ? 'percent'
          : row.publicVoteDisplay === 'hide'
            ? 'hide'
            : 'count';
      const displayedVotes =
        displayMode === 'real_plus_dummy'
          ? Number(row.realVotes || 0) + draftDummyVotes
          : Number(row.realVotes || 0);

      if (!groups.has(key)) {
        groups.set(key, {
          targetType: row.targetType,
          targetId: row.targetId,
          targetTitle: row.targetTitle,
          voteDisplayMode: displayMode,
          publicVoteDisplay,
          rows: [],
        });
      }

      groups.get(key).rows.push({
        ...row,
        draftDummyVotes,
        displayedVotes,
      });
    }

    return Array.from(groups.values())
      .map((group) => {
        const rows = [...group.rows].sort((a, b) => {
          if (b.displayedVotes !== a.displayedVotes) {
            return b.displayedVotes - a.displayedVotes;
          }
          return b.amountUsed - a.amountUsed;
        });

        const totalDisplayedVotes = rows.reduce(
          (sum, row) => sum + Number(row.displayedVotes || 0),
          0
        );

        return {
          ...group,
          rows,
          totalDisplayedVotes,
        };
      })
      .sort((a, b) => a.targetTitle.localeCompare(b.targetTitle));
  }, [dummyVoteDrafts, dummyVoteRows]);

  const updateDisplayMode = async (target) => {
    if (!target?.targetId || !target?.targetType) return;

    const nextMode =
      target.voteDisplayMode === 'real_plus_dummy' ? 'real' : 'real_plus_dummy';
    const savingKey = `${target.targetType}::${target.targetId}`;

    setSavingDisplayTarget(savingKey);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/admin/dummy-votes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_display_mode',
          targetType: target.targetType,
          targetId: target.targetId,
          displayMode: nextMode,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update contest display mode');
        return;
      }

      setFeedback(data.message || 'Contest display mode updated.');
      await loadDummyVotes();
    } catch {
      setError('Unable to update display mode right now.');
    } finally {
      setSavingDisplayTarget('');
    }
  };

  const updatePublicVoteDisplay = async (target, nextValue) => {
    if (!target?.targetId || !target?.targetType) return;

    const savingKey = `${target.targetType}::${target.targetId}`;
    setSavingPublicDisplayTarget(savingKey);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/admin/dummy-votes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_public_vote_display',
          targetType: target.targetType,
          targetId: target.targetId,
          publicVoteDisplay: nextValue,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update public vote display');
        return;
      }

      setFeedback(data.message || 'Public vote display updated.');
      await loadDummyVotes();
    } catch {
      setError('Unable to update public vote display right now.');
    } finally {
      setSavingPublicDisplayTarget('');
    }
  };

  const downloadRankingPdf = (target) => {
    if (!target?.rows?.length) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const rankX = margin;
    const nameX = 95;
    const amountX = 390;
    const percentX = 505;
    const rowHeight = 22;
    const downloadedAt = new Date().toLocaleString();
    const totalVotes = Math.max(1, Number(target.totalDisplayedVotes || 0));

    const drawHeader = (isFirstPage = false) => {
      let y = 56;

      if (isFirstPage) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(String(target.targetTitle || 'Contest Ranking'), margin, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Downloaded: ${downloadedAt}`, margin, y);
        y += 22;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('NimblyPolls', margin, y);
        y += 26;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Rank', rankX, y);
      doc.text('Contestant Name', nameX, y);
      doc.text('Amount Used for Voting', amountX, y, { align: 'right' });
      doc.text(
        target.publicVoteDisplay === 'percent'
          ? 'Percentage'
          : target.publicVoteDisplay === 'hide'
            ? 'Public Display'
            : 'Votes',
        percentX,
        y,
        { align: 'right' }
      );
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);
      return y + 22;
    };

    let y = drawHeader(true);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    target.rows.forEach((row, index) => {
      if (y > pageHeight - 48) {
        doc.addPage();
        y = drawHeader(false);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      const percent = (
        (Number(row.displayedVotes || 0) / totalVotes) *
        100
      ).toFixed(2);
      const publicDisplayValue =
        target.publicVoteDisplay === 'percent'
          ? `${percent}%`
          : target.publicVoteDisplay === 'hide'
            ? 'Hidden'
            : String(row.displayedVotes || 0);
      const safeName =
        String(row.contestantName || 'Contestant').length > 38
          ? `${String(row.contestantName).slice(0, 38)}...`
          : String(row.contestantName || 'Contestant');

      doc.text(String(index + 1), rankX, y);
      doc.text(safeName, nameX, y);
      doc.text(formatKsh(Number(row.amountUsed || 0)), amountX, y, {
        align: 'right',
      });
      doc.text(publicDisplayValue, percentX, y, { align: 'right' });
      y += rowHeight;
    });

    const slug =
      String(target.targetTitle || 'contest')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'contest';
    doc.save(`${slug}-ranking.pdf`);
  };

  const reviewFundRequest = async (requestId, status) => {
    setFundActionId(requestId);
    setError('');
    setFeedback('');

    let reviewNote = '';
    if (status === 'rejected') {
      reviewNote = window.prompt('Enter rejection reason') || '';
      if (!reviewNote.trim()) {
        setError('Rejection reason is required.');
        setFundActionId('');
        return;
      }
    }

    if (status === 'approved') {
      setFundOtp('');
      setOtpDialog({
        requestId,
        approvalToken: '',
        approverEmail: '',
        sending: true,
      });
    }

    try {
      const response = await fetch('/api/admin/fund-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, reviewNote }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        if (status === 'approved') setOtpDialog(null);
        setError(data?.message || 'Unable to update fund request');
        return;
      }

      setFeedback(data.message || `Request ${status}`);
      if (status === 'approved') {
        setFundOtp('');
        setOtpDialog((current) => ({
          ...current,
          approvalToken: data.approvalToken,
          approverEmail: data.approverEmail,
          sending: false,
        }));
      } else {
        await loadFundRequests();
      }
    } catch {
      if (status === 'approved') setOtpDialog(null);
      setError('Fund request update failed. Please try again.');
    } finally {
      setFundActionId('');
    }
  };

  const confirmFundOtp = async (event) => {
    event.preventDefault();
    if (!otpDialog || !/^\d{6}$/.test(fundOtp)) {
      setError('Enter the six-digit OTP sent to the superadmin email.');
      return;
    }

    setVerifyingFundOtp(true);
    setError('');
    try {
      const response = await fetch('/api/admin/fund-requests/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: otpDialog.approvalToken,
          otp: fundOtp,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to verify OTP.');
        return;
      }

      setOtpDialog(null);
      setFundOtp('');
      setFeedback(data.message || 'Fund request approved.');
      await loadFundRequests();
    } catch {
      setError('Unable to verify OTP. Please try again.');
    } finally {
      setVerifyingFundOtp(false);
      setFundActionId('');
    }
  };

  const filteredFundRequests = useMemo(() => {
    const query = fundSearch.trim().toLowerCase();

    return fundRequests.filter((request) => {
      const matchesStatus =
        fundStatusFilter === 'all' || request.status === fundStatusFilter;
      const searchableText = [
        request.organizerName,
        request.organizerEmail,
        request.mpesaNumber,
        request.accountName,
        request.requestPurpose,
        request._id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [fundRequests, fundSearch, fundStatusFilter]);

  const fundPageCount = Math.max(
    1,
    Math.ceil(filteredFundRequests.length / fundPageSize)
  );
  const visibleFundRequests = filteredFundRequests.slice(
    (fundPage - 1) * fundPageSize,
    fundPage * fundPageSize
  );

  const fundAnalytics = useMemo(() => {
    const total = fundRequests.length;
    const approved = fundRequests.filter(
      (request) => request.status === 'approved'
    );
    const pending = fundRequests.filter((request) =>
      ['pending', 'pending_email_approval'].includes(request.status)
    );
    const totalAmount = fundRequests.reduce(
      (sum, request) => sum + Number(request.amount || 0),
      0
    );
    const approvedAmount = approved.reduce(
      (sum, request) => sum + Number(request.amount || 0),
      0
    );
    const pendingAmount = pending.reduce(
      (sum, request) => sum + Number(request.amount || 0),
      0
    );

    return {
      total,
      totalAmount,
      approvedAmount,
      pendingAmount,
      approvalRate: total ? Math.round((approved.length / total) * 100) : 0,
    };
  }, [fundRequests]);

  const printFundReceipt = (request) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      setError('Please allow pop-ups to print the fund receipt.');
      return;
    }

    const receiptNumber = String(request._id || '')
      .slice(-8)
      .toUpperCase();
    const approvedOn = request.emailApprovalCompletedAt || request.updatedAt;
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Fund Approval Receipt ${receiptNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 40px; }
            h1 { margin-bottom: 4px; }
            h2 { margin-top: 0; color: #555; font-weight: normal; }
            hr { border: 0; border-top: 1px solid #ccc; margin: 24px 0; }
            table { border-collapse: collapse; width: 100%; }
            td { border-bottom: 1px solid #eee; padding: 10px 0; }
            td:first-child { font-weight: bold; width: 35%; }
            .approved { color: #16803c; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>NimblyPolls</h1>
          <h2>Fund Approval Receipt</h2>
          <hr />
          <table>
            <tr><td>Receipt number</td><td>${receiptNumber || '-'}</td></tr>
            <tr><td>Organizer</td><td>${request.organizerName || '-'}</td></tr>
            <tr><td>Email</td><td>${request.organizerEmail || '-'}</td></tr>
            <tr><td>M-PESA number</td><td>${request.mpesaNumber || '-'}</td></tr>
            <tr><td>Account name</td><td>${request.accountName || '-'}</td></tr>
            <tr><td>Amount</td><td>${formatKsh(request.amount)}</td></tr>
            <tr><td>Purpose</td><td>${request.requestPurpose || '-'}</td></tr>
            <tr><td>Status</td><td class="approved">APPROVED</td></tr>
            <tr><td>Approved on</td><td>${approvedOn ? new Date(approvedOn).toLocaleString() : '-'}</td></tr>
          </table>
          <hr />
          <p>This receipt confirms approval for payout processing.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">
          Admin Approval Panel
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review organizer submissions before they become visible to the public.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card/85 p-5">
          <Clock3 className="h-5 w-5 text-warning" />
          <p className="mt-2 text-sm text-muted-foreground">Pending Events</p>
          <p className="text-2xl font-semibold">{totals.pending}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card/85 p-5">
          <Check className="h-5 w-5 text-success" />
          <p className="mt-2 text-sm text-muted-foreground">
            Potential Queue Revenue
          </p>
          <p className="text-2xl font-semibold">
            {formatKsh(totals.totalPotentialRevenue)}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card/85 p-5">
          <Ticket className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Published Public Events
          </p>
          <p className="text-2xl font-semibold">{totals.published}</p>
        </article>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card/70 p-2">
        {[
          { key: 'approvals', label: 'Approvals' },
          { key: 'verification', label: 'Vote Verification' },
          { key: 'ticket-verification', label: 'Ticket Verification' },
          { key: 'dummy-votes', label: 'Dummy Votes' },
          { key: 'funds', label: 'Fund Requests' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-foreground hover:border-primary/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(fundActionId && !otpDialog) || verifyingFundOtp ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="mt-4 font-semibold text-foreground">
              {verifyingFundOtp
                ? 'Verifying OTP...'
                : 'Sending OTP to the superadmin email...'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Please wait.</p>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {activeTab === 'approvals' ? (
        <>
          <section className="rounded-2xl border border-border bg-card/85 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                Event Approval Queue
              </h2>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                  <Users className="mr-1 h-3.5 w-3.5" />
                  Moderation Active
                </span>
                <Link
                  href="/admin/voting"
                  className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-primary/70"
                >
                  Manage Voting
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-3">Event</th>
                    <th className="px-2 py-3">Organizer</th>
                    <th className="px-2 py-3">Venue</th>
                    <th className="px-2 py-3">Price</th>
                    <th className="px-2 py-3">Status</th>
                    <th className="px-2 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        className="px-2 py-4 text-sm text-muted-foreground"
                        colSpan={6}
                      >
                        Loading queue...
                      </td>
                    </tr>
                  ) : queue.length === 0 ? (
                    <tr>
                      <td
                        className="px-2 py-4 text-sm text-muted-foreground"
                        colSpan={6}
                      >
                        No pending events right now.
                      </td>
                    </tr>
                  ) : (
                    queue.map((item) => (
                      <tr key={item._id} className="border-b border-border/60">
                        <td className="px-2 py-3 font-medium text-foreground">
                          {item.title}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {item.organizerId?.organizationName ||
                            item.organizerName}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {item.venue}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {formatKsh(
                            (Array.isArray(item.tiers)
                              ? item.tiers
                              : []
                            ).reduce(
                              (sum, tier) => sum + Number(tier?.price || 0),
                              0
                            )
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              item.status === 'approved'
                                ? 'bg-success/15 text-success'
                                : item.status === 'rejected'
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-warning/15 text-warning'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="space-y-2">
                            <div className="grid gap-1 sm:grid-cols-3">
                              {[
                                ['ticketCommissionPercent', 'Ticket'],
                                ['merchandiseCommissionPercent', 'Merchandise'],
                                ['votingCommissionPercent', 'Voting'],
                              ].map(([key, label]) => (
                                <label
                                  key={key}
                                  className="text-[10px] font-semibold text-muted-foreground"
                                >
                                  {label} %
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={getCommissionDraft(item)[key]}
                                    onChange={(e) =>
                                      updateCommissionDraft(
                                        item,
                                        key,
                                        e.target.value
                                      )
                                    }
                                    className="mt-0.5 w-full rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground"
                                  />
                                </label>
                              ))}
                            </div>
                            {item.eventType === 'competition' ? (
                              <label className="block text-[10px] font-semibold text-muted-foreground">
                                Contestant ticket event
                                <select
                                  className="mt-0.5 w-full rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground"
                                  value={
                                    ticketEventSelections[item._id] ||
                                    String(item.competition?.ticketEventId || '')
                                  }
                                  onChange={(event) =>
                                    setTicketEventSelections((previous) => ({
                                      ...previous,
                                      [item._id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">
                                    Select an approved ticket event
                                  </option>
                                  {approvedEvents
                                    .filter(
                                      (ticketEvent) =>
                                        ticketEvent.status === 'approved' &&
                                        (!ticketEvent.eventType ||
                                          ticketEvent.eventType === 'ticketing') &&
                                        String(
                                          ticketEvent.organizerId?._id ||
                                            ticketEvent.organizerId
                                        ) ===
                                          String(
                                            item.organizerId?._id ||
                                              item.organizerId
                                          )
                                    )
                                    .map((ticketEvent) => (
                                      <option
                                        key={ticketEvent._id}
                                        value={ticketEvent._id}
                                      >
                                        {ticketEvent.title}
                                      </option>
                                    ))}
                                </select>
                              </label>
                            ) : null}
                            <div className="flex gap-2">
                              <button
                                onClick={() => review(item._id, 'approve')}
                                disabled={actionEventId === item._id}
                                className="rounded-md border border-success/60 px-3 py-1 text-xs text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Approve & Go Live
                              </button>
                              <button
                                onClick={() => review(item._id, 'reject')}
                                disabled={actionEventId === item._id}
                                className="rounded-md border border-destructive/60 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/85 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Approved Event Sharing Links
                </h2>
                <p className="text-sm text-muted-foreground">
                  Share each event&apos;s direct contestant registration and
                  voting links with its organiser.
                </p>
              </div>
            </div>

            {approvedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved events are available yet.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {approvedEvents.map((event) => {
                  const eventId = encodeURIComponent(String(event._id));
                  const registrationUrl = `${siteOrigin}/nominee/register/${eventId}`;
                  const votingUrl = `${siteOrigin}/voting/${eventId}`;
                  const ticketUrl = `${siteOrigin}/events?eventId=${encodeURIComponent(String(event._id))}#event-${event._id}`;

                  return (
                    <article
                      key={event._id}
                      className="rounded-xl border border-border/70 bg-background/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">
                          {event.title}
                        </h3>
                        <Link
                          href={`/admin/shop?eventId=${eventId}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          View Merchandise
                        </Link>
                      </div>
                      <div className="mt-3 space-y-3">
                        {[
                          [
                            'Contestant Registration Link',
                            registrationUrl,
                            'registration',
                          ],
                          ['Voting Link', votingUrl, 'voting'],
                          ['Ticket Purchase Link', ticketUrl, 'ticket'],
                        ].map(([label, url, kind]) => (
                          <div key={kind}>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              {label}
                            </p>
                            <div className="mt-1 flex gap-2">
                              <input
                                readOnly
                                value={url}
                                aria-label={`${event.title} ${label}`}
                                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                              />
                              <button
                                type="button"
                                onClick={() => shareEventLink(event, kind)}
                                title="Copy or share link"
                                aria-label={`Copy or share ${label.toLowerCase()}`}
                                className="inline-flex items-center justify-center rounded-md border border-border px-2.5 text-foreground hover:border-primary/60"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      {activeTab === 'verification' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              Vote Verification
            </h2>
          </div>
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={verifyVotes}
          >
            <input
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Paste M-PESA transaction code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
            />
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={verifying}
            >
              {verifying ? 'Verifying...' : 'Verify Votes'}
            </button>
          </form>

          {verificationResult ? (
            <div className="mt-5 space-y-3">
              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {verificationResult.recorded ? 'Recorded' : 'Not Recorded'}
                  </p>
                </article>
                <article className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Votes Purchased
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {verificationResult.totalVotes || 0}
                  </p>
                </article>
                <article className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Matches Found
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {(verificationResult.matches || []).length}
                  </p>
                </article>
              </div>

              <article className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Vote Recorded For
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground md:text-base">
                  {recordedContestants.length > 0
                    ? recordedContestants.join(', ')
                    : 'No recorded contestant found for this code yet.'}
                </p>
              </article>
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-3">Transaction</th>
                  <th className="px-2 py-3">Type</th>
                  <th className="px-2 py-3">Votes</th>
                  <th className="px-2 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(verificationResult?.matches || []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={4}>
                      No matching vote payment found yet.
                    </td>
                  </tr>
                ) : (
                  verificationResult.matches.map((match) => (
                    <tr key={match.id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium text-foreground">
                        {match.mpesaReceiptNumber ||
                          match.checkoutRequestId ||
                          '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.type}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.votes}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.recorded ? 'Recorded' : 'Not Recorded'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'ticket-verification' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              Ticket Verification
            </h2>
          </div>
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={verifyTicket}
          >
            <input
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Paste M-PESA transaction code"
              value={ticketVerificationCode}
              onChange={(e) => setTicketVerificationCode(e.target.value)}
              required
            />
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={verifyingTicket}
            >
              {verifyingTicket ? 'Verifying...' : 'Verify Ticket'}
            </button>
          </form>

          {ticketVerificationResult ? (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Status
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {ticketVerificationResult.recorded
                    ? 'Recorded'
                    : 'Not Recorded'}
                </p>
              </article>
              <article className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Matches Found
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {(ticketVerificationResult.matches || []).length}
                </p>
              </article>
              <article className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Entry Status
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {(ticketVerificationResult.matches || [])
                    .map((item) => item.entryStatus)
                    .join(', ') || 'N/A'}
                </p>
              </article>
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-3">Transaction</th>
                  <th className="px-2 py-3">Ticket Code</th>
                  <th className="px-2 py-3">Event</th>
                  <th className="px-2 py-3">Tier</th>
                  <th className="px-2 py-3">Qty</th>
                  <th className="px-2 py-3">Amount</th>
                  <th className="px-2 py-3">Phone</th>
                  <th className="px-2 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(ticketVerificationResult?.matches || []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                      No matching ticket payment found yet.
                    </td>
                  </tr>
                ) : (
                  ticketVerificationResult.matches.map((match) => (
                    <tr key={match.id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium text-foreground">
                        {match.mpesaReceiptNumber ||
                          match.checkoutRequestId ||
                          '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.ticketCode || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.eventTitle || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.tierName || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.quantity}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {formatKsh(match.totalAmount)}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.customerPhone || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {match.recorded ? 'Recorded' : 'Not Recorded'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'funds' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              Fund Requests
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredFundRequests.length} matching request
              {filteredFundRequests.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Total requested
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatKsh(fundAnalytics.totalAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fundAnalytics.total} request
                {fundAnalytics.total === 1 ? '' : 's'}
              </p>
            </article>
            <article className="rounded-xl border border-success/30 bg-success/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-success">
                Approved payout
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatKsh(fundAnalytics.approvedAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Completed approvals
              </p>
            </article>
            <article className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-warning">
                Awaiting action
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatKsh(fundAnalytics.pendingAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pending and awaiting OTP
              </p>
            </article>
            <article className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-primary">
                Approval rate
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {fundAnalytics.approvalRate}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on all requests
              </p>
            </article>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_120px]">
            <label className="sr-only" htmlFor="fund-request-search">
              Search fund requests
            </label>
            <input
              id="fund-request-search"
              type="search"
              value={fundSearch}
              onChange={(event) => {
                setFundSearch(event.target.value);
                setFundPage(1);
              }}
              placeholder="Search organizer, email, M-PESA, account..."
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <label className="sr-only" htmlFor="fund-status-filter">
              Filter fund requests by status
            </label>
            <select
              id="fund-status-filter"
              value={fundStatusFilter}
              onChange={(event) => {
                setFundStatusFilter(event.target.value);
                setFundPage(1);
              }}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="pending_email_approval">Awaiting OTP</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              aria-label="Requests per page"
              value={fundPageSize}
              onChange={(event) => {
                setFundPageSize(Number(event.target.value));
                setFundPage(1);
              }}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>

          {loadingFunds ? (
            <p className="text-sm text-muted-foreground">
              Loading fund requests...
            </p>
          ) : filteredFundRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fund requests match your search.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-3">Organizer</th>
                    <th className="px-2 py-3">M-PESA Number</th>
                    <th className="px-2 py-3">Amount</th>
                    <th className="px-2 py-3">Status</th>
                    <th className="px-2 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFundRequests.map((request) => (
                    <tr key={request._id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium text-foreground">
                        {request.organizerName}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {request.mpesaNumber}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {formatKsh(request.amount)}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {request.status}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          {request.status !== 'approved' ? (
                            <button
                              onClick={() =>
                                reviewFundRequest(request._id, 'approved')
                              }
                              disabled={Boolean(fundActionId)}
                              className="rounded-md border border-success/60 px-3 py-1 text-xs text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Approve
                            </button>
                          ) : null}
                          <button
                            onClick={() =>
                              reviewFundRequest(request._id, 'rejected')
                            }
                            disabled={Boolean(fundActionId)}
                            className="rounded-md border border-destructive/60 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reject
                          </button>
                          {request.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => printFundReceipt(request)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Print receipt
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(fundPage - 1) * fundPageSize + 1}–
                  {Math.min(
                    fundPage * fundPageSize,
                    filteredFundRequests.length
                  )}{' '}
                  of {filteredFundRequests.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFundPage((page) => Math.max(1, page - 1))}
                    disabled={fundPage === 1}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {Math.min(fundPage, fundPageCount)} of {fundPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFundPage((page) => Math.min(fundPageCount, page + 1))
                    }
                    disabled={fundPage >= fundPageCount}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'dummy-votes' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-foreground">
              Super Admin Dummy Votes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dummy votes are separate from real votes and do not affect real
              revenue, paid transactions, or money collected.
            </p>
          </div>

          {loadingDummyVotes ? (
            <p className="text-sm text-muted-foreground">
              Loading contestant vote rows...
            </p>
          ) : null}

          <div className="mt-4 space-y-6">
            {groupedDummyVoteTargets.length === 0 ? (
              <div className="rounded-xl border border-border bg-background/50 p-4 text-sm text-muted-foreground">
                No eligible contestants found for dummy vote controls.
              </div>
            ) : (
              groupedDummyVoteTargets.map((target) => {
                const targetKey = `${target.targetType}::${target.targetId}`;
                const showingCombined =
                  target.voteDisplayMode === 'real_plus_dummy';

                return (
                  <article
                    key={targetKey}
                    className="rounded-2xl border border-border bg-background/40 p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {target.targetTitle}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {target.targetType === 'competition_event'
                            ? 'Competition Event'
                            : 'Voting Campaign'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateDisplayMode(target)}
                          disabled={savingDisplayTarget === targetKey}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                        >
                          {savingDisplayTarget === targetKey
                            ? 'Saving...'
                            : showingCombined
                              ? 'Show Real Votes'
                              : 'Show Real + Dummy Votes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadRankingPdf(target)}
                          className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Download Ranking PDF
                        </button>
                        <select
                          value={target.publicVoteDisplay}
                          onChange={(e) =>
                            updatePublicVoteDisplay(target, e.target.value)
                          }
                          disabled={savingPublicDisplayTarget === targetKey}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                        >
                          <option value="count">Public: Numerical Votes</option>
                          <option value="percent">
                            Public: Percentage (%)
                          </option>
                          <option value="hide">Public: Hide</option>
                        </select>
                      </div>
                    </div>

                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Display mode:{' '}
                      {showingCombined ? 'Real + Dummy Votes' : 'Real Votes'}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Public display:{' '}
                      {target.publicVoteDisplay === 'percent'
                        ? 'Percentage (%)'
                        : target.publicVoteDisplay === 'hide'
                          ? 'Hide'
                          : 'Numerical Votes'}
                    </p>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="px-2 py-3">Rank</th>
                            <th className="px-2 py-3">Contestant</th>
                            <th className="px-2 py-3">Real Votes</th>
                            <th className="px-2 py-3">Dummy Votes</th>
                            <th className="px-2 py-3">Displayed Votes</th>
                            <th className="px-2 py-3">
                              Amount Used for Voting
                            </th>
                            <th className="px-2 py-3">Public Display</th>
                            <th className="px-2 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {target.rows.map((row, index) => {
                            const rowKey = `${row.targetType}::${row.targetId}::${row.contestantKey}`;
                            const percent =
                              target.totalDisplayedVotes > 0
                                ? (
                                    (Number(row.displayedVotes || 0) /
                                      Number(target.totalDisplayedVotes || 1)) *
                                    100
                                  ).toFixed(2)
                                : '0.00';
                            const publicDisplayValue =
                              target.publicVoteDisplay === 'percent'
                                ? `${percent}%`
                                : target.publicVoteDisplay === 'hide'
                                  ? 'Hidden'
                                  : String(row.displayedVotes || 0);

                            return (
                              <tr
                                key={rowKey}
                                className="border-b border-border/60"
                              >
                                <td className="px-2 py-3 font-semibold text-foreground">
                                  #{index + 1}
                                </td>
                                <td className="px-2 py-3">
                                  <p className="font-medium text-foreground">
                                    {row.contestantName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {row.contestantCategory || 'General'}
                                  </p>
                                </td>
                                <td className="px-2 py-3 text-muted-foreground">
                                  {row.realVotes}
                                </td>
                                <td className="px-2 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    value={
                                      dummyVoteDrafts[rowKey] ?? row.dummyVotes
                                    }
                                    onChange={(e) =>
                                      setDummyVoteDrafts((prev) => ({
                                        ...prev,
                                        [rowKey]: e.target.value,
                                      }))
                                    }
                                    className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                                  />
                                </td>
                                <td className="px-2 py-3 font-semibold text-foreground">
                                  {row.displayedVotes}
                                </td>
                                <td className="px-2 py-3 text-muted-foreground">
                                  {formatKsh(Number(row.amountUsed || 0))}
                                </td>
                                <td className="px-2 py-3 text-muted-foreground">
                                  {publicDisplayValue}
                                </td>
                                <td className="px-2 py-3">
                                  <button
                                    type="button"
                                    onClick={() => saveDummyVotes(row)}
                                    disabled={savingDummyKey === rowKey}
                                    className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-primary/60 disabled:opacity-60"
                                  >
                                    {savingDummyKey === rowKey
                                      ? 'Saving...'
                                      : 'Save'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      ) : null}

      {otpDialog ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Awaiting OTP verification
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {otpDialog.sending
                    ? 'Sending a six-digit OTP to the superadmin account email...'
                    : 'A six-digit OTP was sent to the superadmin account email:'}
                </p>
                {!otpDialog.sending ? (
                  <p className="mt-1 break-all font-medium text-primary">
                    {otpDialog.approverEmail}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOtpDialog(null)}
                className="text-2xl leading-none text-muted-foreground hover:text-foreground"
                aria-label="Close OTP dialog"
              >
                &times;
              </button>
            </div>
            <form onSubmit={confirmFundOtp} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-foreground">
                Enter OTP
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={fundOtp}
                  onChange={(event) =>
                    setFundOtp(event.target.value.replace(/\D/g, ''))
                  }
                  autoFocus
                  disabled={otpDialog.sending || !otpDialog.approvalToken}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-2xl tracking-[0.5em] text-foreground outline-none focus:border-primary"
                  placeholder="000000"
                  required
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOtpDialog(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    otpDialog.sending ||
                    verifyingFundOtp ||
                    !otpDialog.approvalToken ||
                    fundOtp.length !== 6
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verifyingFundOtp ? 'Verifying...' : 'Verify and approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
