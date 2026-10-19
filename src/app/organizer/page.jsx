'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { jsPDF } from 'jspdf';
import {
  Activity,
  ArrowRight,
  Camera,
  CircleCheckBig,
  Clock3,
  Layers3,
  Pencil,
  Plus,
  Printer,
  Settings,
  Share2,
  Sparkles,
  Ticket,
  Trash2,
  Wallet,
  X,
  Copy,
  Vote,
} from 'lucide-react';
import { formatKsh } from '@/lib/currency';
import { ImageCropUploadField } from '@/components/ui/ImageCropUploadField';

const MAX_BANNER_WIDTH = 1920;
const MAX_BANNER_HEIGHT = 1080;
const MAX_BANNER_FILE_SIZE = 5 * 1024 * 1024;

const fallbackTicketTypes = [
  { name: 'vip', defaultPrice: 0, defaultSlots: 0, isActive: true },
  { name: 'regular', defaultPrice: 0, defaultSlots: 0, isActive: true },
];

const fallbackVotePackages = [
  { name: 'Basic', votes: 1, price: 20, isActive: true },
  { name: 'Supporter', votes: 5, price: 100, isActive: true },
  { name: 'Champion', votes: 10, price: 200, isActive: true },
];

const DEFAULT_COMPETITION_MAX_VOTES_PER_TXN = 1000;

function buildTierDrafts(types = []) {
  return (Array.isArray(types) ? types : []).map((item) => ({
    name: String(item?.name || '')
      .trim()
      .toLowerCase(),
    price: Number(item?.defaultPrice || 0),
    totalSlots: Number(item?.defaultSlots || 0),
    description: String(item?.description || ''),
    isActive: true,
  }));
}

function countWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function emptyContestant() {
  return {
    fullName: '',
    profileImageUrl: '',
    category: '',
    votes: 0,
  };
}

function emptyPollNominee() {
  return { name: '', category: 'General', tagline: '', imageUrl: '' };
}

function emptyOrganizerPollForm() {
  return {
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    nominees: [emptyPollNominee(), emptyPollNominee()],
  };
}

function emptyVotePackage() {
  return {
    name: '',
    votes: 1,
    price: 20,
    isActive: true,
  };
}

function emptyFundRequest() {
  return {
    eventId: '',
    mpesaNumber: '',
    accountName: '',
    amount: '',
    requestPurpose: '',
  };
}

function normalizeMpesaNumber(value) {
  const trimmed = String(value || '').replace(/\s+/g, '');
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  return '';
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = new window.Image();

    probe.onload = () => {
      const width = probe.naturalWidth;
      const height = probe.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read image dimensions'));
    };

    probe.src = objectUrl;
  });
}

function toDateTimeLocalValue(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  const local = new Date(
    safeDate.getTime() - safeDate.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 16);
}

function normalizeEventType(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'competition'
    ? 'competition'
    : 'ticketing';
}

function normalizeCompetitionMaxVotes(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_COMPETITION_MAX_VOTES_PER_TXN;
  return Math.min(10000, Math.max(1, parsed));
}

export default function OrganizerDashboardPage() {
  const [events, setEvents] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeEvent, setActiveEvent] = useState(null);
  const [organizerProfile, setOrganizerProfile] = useState(null);
  const [activePanel, setActivePanel] = useState('overview');
  const [organizerPolls, setOrganizerPolls] = useState([]);
  const [organizerTicketSales, setOrganizerTicketSales] = useState([]);
  const [loadingOrganizerPolls, setLoadingOrganizerPolls] = useState(false);
  const [creatingOrganizerPoll, setCreatingOrganizerPoll] = useState(false);
  const [editingOrganizerPollId, setEditingOrganizerPollId] = useState('');
  const [organizerPollMessage, setOrganizerPollMessage] = useState('');
  const [organizerPollCopyToast, setOrganizerPollCopyToast] = useState('');
  const [organizerPollForm, setOrganizerPollForm] = useState(
    emptyOrganizerPollForm()
  );
  const pollDefaultsEventIdRef = useRef('');
  const [stats, setStats] = useState({
    collectedFunds: 0,
    soldTickets: 0,
    paidOrders: 0,
  });
  const [competitionAnalytics, setCompetitionAnalytics] = useState({
    byContestant: [],
  });
  const [loading, setLoading] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingContestantKey, setUploadingContestantKey] = useState('');
  const [bannerMeta, setBannerMeta] = useState(null);
  const [localBannerPreview, setLocalBannerPreview] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const localPreviewUrlRef = useRef(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [managedTicketTypes, setManagedTicketTypes] = useState([]);
  const [votePackageTemplates, setVotePackageTemplates] =
    useState(fallbackVotePackages);
  const [organizerSettingsSnapshot, setOrganizerSettingsSnapshot] = useState({
    votePackages: fallbackVotePackages,
    calendar: {
      timezone: 'Africa/Nairobi',
      weekStartsOn: 'monday',
      defaultEventDurationHours: 4,
    },
    promoters: [],
  });
  const [fundRequests, setFundRequests] = useState([]);
  const [fundsSnapshot, setFundsSnapshot] = useState({
    organizerEarnings: 0,
    reservedDisbursementAmount: 0,
    fundsAvailableForDisbursement: 0,
  });
  const [fundRequestForm, setFundRequestForm] = useState(emptyFundRequest());
  const [savingTicketTypes, setSavingTicketTypes] = useState(false);
  const [submittingFundRequest, setSubmittingFundRequest] = useState(false);
  const [editingEventId, setEditingEventId] = useState('');
  const [newCompetitionCategory, setNewCompetitionCategory] = useState('');
  const [rankingMessage, setRankingMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    eventType: 'ticketing',
    description: '',
    category: '',
    venue: '',
    city: '',
    bannerUrl: '',
    startDateTime: '',
    endDateTime: '',
    tiers: [],
    categories: [],
    contestants: [emptyContestant()],
    votePackages: [emptyVotePackage()],
    maxVotesPerTransaction: DEFAULT_COMPETITION_MAX_VOTES_PER_TXN,
    publicVoteDisplay: 'count',
  });

  const loadOrganizerSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/organizer/settings', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) return;

      const allTypes = Array.isArray(data.settings?.ticketTypes)
        ? data.settings.ticketTypes
        : [];
      const activeTypes = allTypes.filter((item) => item?.isActive !== false);
      const usable = activeTypes.length > 0 ? activeTypes : fallbackTicketTypes;

      const activeVotePackages = (data.settings?.votePackages || []).filter(
        (item) => item?.isActive !== false
      );
      const usableVotePackages =
        activeVotePackages.length > 0
          ? activeVotePackages
          : fallbackVotePackages;

      setTicketTypes(usable);
      setManagedTicketTypes(
        allTypes.length > 0 ? allTypes : fallbackTicketTypes
      );
      setVotePackageTemplates(usableVotePackages);
      setOrganizerSettingsSnapshot({
        votePackages: Array.isArray(data.settings?.votePackages)
          ? data.settings.votePackages
          : fallbackVotePackages,
        calendar: data.settings?.calendar || {
          timezone: 'Africa/Nairobi',
          weekStartsOn: 'monday',
          defaultEventDurationHours: 4,
        },
        promoters: Array.isArray(data.promoters) ? data.promoters : [],
      });
      setForm((prev) => ({
        ...prev,
        tiers: buildTierDrafts(usable),
        votePackages:
          prev.eventType === 'competition' &&
          (prev.votePackages || []).length < 1
            ? usableVotePackages
            : prev.votePackages,
      }));
    } catch {
      setTicketTypes(fallbackTicketTypes);
      setManagedTicketTypes(fallbackTicketTypes);
      setVotePackageTemplates(fallbackVotePackages);
      setOrganizerSettingsSnapshot({
        votePackages: fallbackVotePackages,
        calendar: {
          timezone: 'Africa/Nairobi',
          weekStartsOn: 'monday',
          defaultEventDurationHours: 4,
        },
        promoters: [],
      });
      setForm((prev) => ({
        ...prev,
        tiers: buildTierDrafts(fallbackTicketTypes),
        votePackages:
          prev.eventType === 'competition' &&
          (prev.votePackages || []).length < 1
            ? fallbackVotePackages
            : prev.votePackages,
      }));
    }
  }, []);

  const loadOrganizerData = useCallback(async () => {
    try {
      const query = selectedEventId
        ? `?scope=dashboard&eventId=${encodeURIComponent(selectedEventId)}`
        : '?scope=dashboard';
      const response = await fetch(`/api/events/organizer${query}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setEvents(data.events || []);
        const options = Array.isArray(data.availableEvents)
          ? data.availableEvents
          : [];
        setAvailableEvents(options);
        setActiveEvent(data.activeEvent || options[0] || null);
        if (!selectedEventId && options[0]?.eventId) {
          setSelectedEventId(options[0].eventId);
        } else if (
          selectedEventId &&
          options.length > 0 &&
          !options.some((item) => item.eventId === selectedEventId)
        ) {
          setSelectedEventId(options[0].eventId);
        }
        setOrganizerProfile(data.organizer || null);
        setStats(
          data.stats || { collectedFunds: 0, soldTickets: 0, paidOrders: 0 }
        );
        setCompetitionAnalytics({
          byContestant: Array.isArray(data.competitionAnalytics?.byContestant)
            ? data.competitionAnalytics.byContestant
            : [],
        });
        setOrganizerTicketSales(
          Array.isArray(data.ticketSalesByContestant)
            ? data.ticketSalesByContestant
            : []
        );
      }
    } catch {
      // no-op for now
      setAvailableEvents([]);
      setActiveEvent(null);
      setCompetitionAnalytics({ byContestant: [] });
      setOrganizerTicketSales([]);
    }
  }, [selectedEventId]);

  const loadOrganizerPolls = useCallback(async () => {
    if (!selectedEventId) {
      setOrganizerPolls([]);
      return;
    }

    setLoadingOrganizerPolls(true);
    try {
      const response = await fetch(
        `/api/voting/campaigns?scope=organizer&eventId=${encodeURIComponent(selectedEventId)}`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      setOrganizerPolls(
        response.ok && data?.success ? data.campaigns || [] : []
      );
      if (!response.ok || !data?.success) {
        setOrganizerPollMessage(data?.message || 'Unable to load event polls.');
      }
    } catch {
      setOrganizerPolls([]);
      setOrganizerPollMessage('Unable to load event polls.');
    } finally {
      setLoadingOrganizerPolls(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadOrganizerPolls();
  }, [loadOrganizerPolls]);

  useEffect(() => {
    const eventId = String(activeEvent?.eventId || '');
    if (!eventId || pollDefaultsEventIdRef.current === eventId) return;

    pollDefaultsEventIdRef.current = eventId;
    setOrganizerPollForm({
      ...emptyOrganizerPollForm(),
      title: `${activeEvent.title} Poll`,
      startDateTime: activeEvent.startDateTime
        ? toDateTimeLocalValue(activeEvent.startDateTime)
        : '',
      endDateTime: activeEvent.endDateTime
        ? toDateTimeLocalValue(activeEvent.endDateTime)
        : '',
    });
  }, [activeEvent]);

  const submitOrganizerPoll = async (event) => {
    event.preventDefault();
    setOrganizerPollMessage('');

    if (!selectedEventId) {
      setOrganizerPollMessage('Select an event before creating its poll.');
      return;
    }

    const nominees = (organizerPollForm.nominees || []).filter(
      (nominee) =>
        String(nominee.name || '').trim().length >= 2 &&
        String(nominee.category || '').trim().length >= 2
    );
    if (nominees.length < 2) {
      setOrganizerPollMessage(
        'Add at least two contestants and assign each a category.'
      );
      return;
    }

    setCreatingOrganizerPoll(true);
    try {
      const response = await fetch(
        editingOrganizerPollId
          ? `/api/voting/campaigns/${editingOrganizerPollId}`
          : '/api/voting/campaigns',
        {
          method: editingOrganizerPollId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selectedEventId,
            title: organizerPollForm.title,
            description: organizerPollForm.description,
            category: activeEvent?.title || 'General',
            startDateTime: organizerPollForm.startDateTime,
            endDateTime: organizerPollForm.endDateTime,
            nominees,
            status: 'pending',
            resultVisibility: 'live',
            publicVoteDisplay: 'count',
            commissionPercent: 20,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setOrganizerPollMessage(data?.message || 'Unable to submit poll.');
        return;
      }

      setOrganizerPollMessage(data.message || 'Poll submitted for approval.');
      setEditingOrganizerPollId('');
      await loadOrganizerPolls();
    } catch {
      setOrganizerPollMessage('Poll submission failed. Please try again.');
    } finally {
      setCreatingOrganizerPoll(false);
    }
  };

  const editOrganizerPoll = (poll) => {
    const toLocalDateTime = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    const nominees = poll.contestants || poll.nominees || [];

    setEditingOrganizerPollId(String(poll._id));
    setOrganizerPollForm({
      title: poll.title || '',
      description: poll.description || '',
      startDateTime: toLocalDateTime(poll.startDateTime),
      endDateTime: toLocalDateTime(poll.endDateTime),
      nominees:
        nominees.length > 0
          ? nominees.map((nominee) => ({
              _id: String(nominee._id || ''),
              name: nominee.name || '',
              category: nominee.category || 'General',
              tagline: nominee.tagline || '',
              imageUrl: nominee.imageUrl || '',
            }))
          : [emptyPollNominee(), emptyPollNominee()],
    });
    setOrganizerPollMessage(
      'Editing poll. Saving will resubmit it for approval.'
    );
  };

  const deleteOrganizerPoll = async (pollId) => {
    if (!window.confirm('Delete this unpublished poll?')) return;
    setOrganizerPollMessage('');
    try {
      const response = await fetch(`/api/voting/campaigns/${pollId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setOrganizerPollMessage(data?.message || 'Unable to delete poll.');
        return;
      }
      setOrganizerPollMessage(data.message || 'Poll deleted.');
      await loadOrganizerPolls();
    } catch {
      setOrganizerPollMessage('Unable to delete poll right now.');
    }
  };

  const copyOrganizerPollLink = async (url) => {
    try {
      const fullUrl = new URL(url, window.location.origin).toString();
      await navigator.clipboard.writeText(fullUrl);
      setOrganizerPollCopyToast('Copied');
      window.setTimeout(() => setOrganizerPollCopyToast(''), 1800);
    } catch {
      setOrganizerPollCopyToast('Could not copy link');
      window.setTimeout(() => setOrganizerPollCopyToast(''), 2200);
    }
  };

  const loadFundRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/organizer/fund-requests', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setFundRequests(Array.isArray(data.requests) ? data.requests : []);
        setFundsSnapshot({
          organizerEarnings: Number(data?.funds?.organizerEarnings || 0),
          reservedDisbursementAmount: Number(
            data?.funds?.reservedDisbursementAmount || 0
          ),
          fundsAvailableForDisbursement: Number(
            data?.funds?.fundsAvailableForDisbursement || 0
          ),
        });
      }
    } catch {
      setFundRequests([]);
      setFundsSnapshot({
        organizerEarnings: 0,
        reservedDisbursementAmount: 0,
        fundsAvailableForDisbursement: 0,
      });
    }
  }, []);

  useEffect(() => {
    loadOrganizerData();
    loadOrganizerSettings();
    loadFundRequests();
  }, [loadOrganizerData, loadOrganizerSettings, loadFundRequests]);

  const counts = useMemo(() => {
    const pending = events.filter((item) => item.status === 'pending').length;
    const approved = events.filter((item) => item.status === 'approved').length;
    const rejected = events.filter((item) => item.status === 'rejected').length;
    const total = events.length;
    return { pending, approved, rejected, total };
  }, [events]);

  const approvalRate =
    counts.total > 0 ? Math.round((counts.approved / counts.total) * 100) : 0;

  const mediaItems = useMemo(
    () => events.filter((item) => item.bannerUrl).slice(0, 8),
    [events]
  );

  const upcomingCount = useMemo(
    () =>
      events.filter((item) => {
        const startsAt = item?.startDateTime
          ? new Date(item.startDateTime).getTime()
          : 0;
        return startsAt > Date.now();
      }).length,
    [events]
  );

  const recentSubmissions = useMemo(
    () =>
      [...events]
        .sort(
          (a, b) =>
            new Date(b?.createdAt || b?.startDateTime || 0).getTime() -
            new Date(a?.createdAt || a?.startDateTime || 0).getTime()
        )
        .slice(0, 4),
    [events]
  );

  const contestantRanking = useMemo(() => {
    const rows = Array.isArray(competitionAnalytics.byContestant)
      ? competitionAnalytics.byContestant
      : [];

    return [...rows]
      .map((item) => ({
        name: String(item?.name || 'Contestant').trim() || 'Contestant',
        votes: Math.max(0, Number(item?.votes || 0)),
        revenue: Math.max(0, Number(item?.revenue || 0)),
      }))
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return b.revenue - a.revenue;
      });
  }, [competitionAnalytics.byContestant]);

  const buildContestantRankingPdfBlob = useCallback(() => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const rankColX = margin;
    const nameColX = 90;
    const votesColX = 340;
    const amountColX = 430;
    const rowHeight = 22;

    const drawHeader = (isFirstPage = false) => {
      let y = 56;
      if (isFirstPage) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Contestants Ranking List', margin, y);
        y += 18;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Event: ${String(activeEvent?.title || 'N/A')}`, margin, y);
        y += 14;
        doc.text(
          `Generated on ${new Date().toLocaleString()} | Organizer Dashboard`,
          margin,
          y
        );
        y += 26;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Rank', rankColX, y);
      doc.text('Contestant Name', nameColX, y);
      doc.text('Votes', votesColX, y, { align: 'right' });
      doc.text('Amount Used for Voting', amountColX, y, { align: 'right' });
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);
      return y + 22;
    };

    let y = drawHeader(true);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    contestantRanking.forEach((row, index) => {
      if (y > pageHeight - 48) {
        doc.addPage();
        y = drawHeader(false);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      const safeName =
        row.name.length > 38 ? `${row.name.slice(0, 38)}...` : row.name;
      doc.text(String(index + 1), rankColX, y);
      doc.text(safeName, nameColX, y);
      doc.text(String(row.votes), votesColX, y, { align: 'right' });
      doc.text(formatKsh(row.revenue), amountColX, y, { align: 'right' });
      y += rowHeight;
    });

    if (contestantRanking.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.text('No paid voting data available yet.', margin, y);
    }

    return doc.output('blob');
  }, [contestantRanking, activeEvent?.title]);

  const handlePrintRanking = useCallback(() => {
    setRankingMessage('');
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      setRankingMessage('Please allow pop-ups to print the ranking list.');
      return;
    }

    const rowsHtml =
      contestantRanking.length === 0
        ? '<tr><td colspan="4" class="empty">No paid voting data available yet.</td></tr>'
        : contestantRanking
            .map(
              (row, index) => `
                <tr>
                  <td class="rank">#${index + 1}</td>
                  <td class="name">${row.name}</td>
                  <td class="num">${row.votes.toLocaleString()}</td>
                  <td class="num">${formatKsh(row.revenue)}</td>
                </tr>`
            )
            .join('');

    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Contestants Ranking List</title>
<style>
  :root { --brand-teal: #00e5c0; --brand-cyan: #1dd1ff; --brand-navy: #0f1b3a; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f1b3a; margin: 0; padding: 32px; }
  .header { text-align: center; border-bottom: 3px solid var(--brand-teal); padding-bottom: 16px; margin-bottom: 20px; }
  .header img { height: 56px; width: 56px; border-radius: 12px; object-fit: cover; margin-bottom: 8px; }
  .header h1 { margin: 4px 0 0; font-size: 22px; color: var(--brand-navy); }
  .header p { margin: 4px 0 0; font-size: 12px; color: #4b5b7e; }
  .brand-bar { height: 6px; background: linear-gradient(90deg, var(--brand-teal), var(--brand-cyan)); border-radius: 4px; margin: 10px auto 0; width: 160px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 10px 14px; font-size: 13px; }
  th { text-align: left; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; border-bottom: 2px solid var(--brand-navy); }
  td { border-bottom: 1px solid #d0d9e8; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .rank { font-weight: 700; }
  .empty { text-align: center; color: #4b5b7e; padding: 20px; }
  .footer { margin-top: 28px; border-top: 1px solid #d0d9e8; padding-top: 12px; font-size: 11px; color: #4b5b7e; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <img src="${window.location.origin}/logo.jpeg" alt="NimblyPolls logo" />
    <h1>Contestants Ranking List</h1>
    <p>Event: ${String(activeEvent?.title || 'N/A')}</p>
    <p>Generated on ${new Date().toLocaleString()} | Organizer Dashboard</p>
    <div class="brand-bar"></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Contestant Name</th>
        <th class="num">Votes</th>
        <th class="num">Amount Used for Voting</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    <p>NimblyPolls &bull; nimblypolls@gmail.com &bull; 0759 673 053</p>
    <p>West End Towers, Waiyaki Way, Nairobi | Mega Plaza, Oginga Odinga Street, Kisumu</p>
  </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
    setRankingMessage('Print dialog opened.');
  }, [contestantRanking, activeEvent?.title]);

  const handleShareRanking = useCallback(async () => {
    setRankingMessage('');
    if (contestantRanking.length === 0) {
      setRankingMessage('No contestant ranking data available to share yet.');
      return;
    }

    const summary = contestantRanking
      .slice(0, 10)
      .map(
        (row, index) =>
          `${index + 1}. ${row.name} - ${row.votes} vote${row.votes === 1 ? '' : 's'} - ${formatKsh(row.revenue)}`
      )
      .join('\n');

    const shareTitle = 'Contestants Ranking List';
    const shareText = `Organizer contestants ranking (highest votes first):\n\n${summary}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        const blob = buildContestantRankingPdfBlob();
        const stamp = new Date().toISOString().slice(0, 10);
        const eventSlug = String(activeEvent?.title || 'event')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 40);
        const fileName = `contestants-ranking-${eventSlug || 'event'}-${stamp}.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: shareTitle,
            text: 'Contestants ranking list attached as PDF.',
            files: [file],
          });
        } else {
          await navigator.share({
            title: shareTitle,
            text: shareText,
          });
        }

        setRankingMessage('Ranking list shared successfully.');
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setRankingMessage(
          'Sharing not supported here. Ranking copied to clipboard.'
        );
        return;
      }

      setRankingMessage('Sharing is not supported on this device/browser.');
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') {
        setRankingMessage('Could not share ranking list right now.');
      }
    }
  }, [buildContestantRankingPdfBlob, contestantRanking, activeEvent?.title]);

  const shareTicketLink = async (event) => {
    const url = `${window.location.origin}/events/${encodeURIComponent(String(event._id))}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${event.title} tickets`,
          text: `Buy tickets for ${event.title}`,
          url,
        });
        setFeedback('Event ticket link shared successfully.');
      } else {
        await navigator.clipboard.writeText(url);
        setFeedback('Event ticket link copied to the clipboard.');
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') {
        setFeedback('Could not share the event ticket link right now.');
      }
    }
  };

  const minStartDateTime = useMemo(() => toDateTimeLocalValue(new Date()), []);
  const minEndDateTime = form.startDateTime || minStartDateTime;
  const hasDuplicateTierSelections = useMemo(() => {
    const names = (form.tiers || [])
      .map((tier) =>
        String(tier?.name || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
    return new Set(names).size !== names.length;
  }, [form.tiers]);

  const resetStudioForm = useCallback(
    (eventType = 'ticketing') => {
      const normalizedEventType = normalizeEventType(eventType);
      setForm({
        title: '',
        eventType: normalizedEventType,
        description: '',
        category: '',
        venue: '',
        city: '',
        bannerUrl: '',
        startDateTime: '',
        endDateTime: '',
        tiers:
          normalizedEventType === 'ticketing'
            ? buildTierDrafts(
                ticketTypes.length > 0 ? ticketTypes : fallbackTicketTypes
              )
            : [],
        categories: [],
        contestants:
          normalizedEventType === 'competition' ? [emptyContestant()] : [],
        votePackages:
          normalizedEventType === 'competition'
            ? votePackageTemplates.length > 0
              ? votePackageTemplates
              : [emptyVotePackage()]
            : [],
        maxVotesPerTransaction: DEFAULT_COMPETITION_MAX_VOTES_PER_TXN,
        publicVoteDisplay: 'count',
      });
    },
    [ticketTypes, votePackageTemplates]
  );

  const startEditingSubmission = useCallback(
    (eventItem) => {
      const nextType = normalizeEventType(eventItem?.eventType);
      const normalizedTiers = Array.isArray(eventItem?.tiers)
        ? eventItem.tiers.map((tier) => ({
            name: String(tier?.name || '')
              .trim()
              .toLowerCase(),
            price: Number(tier?.price || 0),
            totalSlots: Number(tier?.totalSlots || 0),
            description: String(tier?.description || ''),
            isActive: tier?.isActive !== false,
          }))
        : [];

      const normalizedContestants = Array.isArray(
        eventItem?.competition?.contestants
      )
        ? eventItem.competition.contestants.map((contestant) => ({
            fullName: String(contestant?.fullName || '').trim(),
            profileImageUrl: String(contestant?.profileImageUrl || '').trim(),
            category: String(contestant?.category || '').trim(),
            votes: Math.max(0, Number(contestant?.votes || 0)),
          }))
        : [];
      const savedCompetitionCategories = Array.isArray(
        eventItem?.competition?.categories
      )
        ? eventItem.competition.categories
            .map((category) => String(category || '').trim())
            .filter(Boolean)
        : [];
      const normalizedCompetitionCategories =
        savedCompetitionCategories.length > 0
          ? savedCompetitionCategories
          : Array.from(
              new Set(
                normalizedContestants
                  .map((contestant) => contestant.category)
                  .filter(Boolean)
              )
            );

      const normalizedVotePackages = Array.isArray(
        eventItem?.competition?.votePackages
      )
        ? eventItem.competition.votePackages.map((pkg) => ({
            name: String(pkg?.name || '').trim(),
            votes: Math.max(1, Number(pkg?.votes || 1)),
            price: Math.max(1, Number(pkg?.price || 1)),
            isActive: pkg?.isActive !== false,
          }))
        : [];
      const normalizedCompetitionMaxVotes = normalizeCompetitionMaxVotes(
        eventItem?.competition?.maxVotesPerTransaction
      );

      setEditingEventId(String(eventItem?._id || ''));
      setError('');
      setFeedback('Editing submission draft in Create Event.');
      setBannerMeta(null);
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
      setLocalBannerPreview('');

      setForm({
        title: String(eventItem?.title || ''),
        eventType: nextType,
        description: String(eventItem?.description || ''),
        category: String(eventItem?.category || ''),
        venue: String(eventItem?.venue || ''),
        city: String(eventItem?.city || ''),
        bannerUrl: String(eventItem?.bannerUrl || ''),
        startDateTime: eventItem?.startDateTime
          ? toDateTimeLocalValue(eventItem.startDateTime)
          : '',
        endDateTime: eventItem?.endDateTime
          ? toDateTimeLocalValue(eventItem.endDateTime)
          : '',
        tiers:
          nextType === 'ticketing'
            ? normalizedTiers.length > 0
              ? normalizedTiers
              : buildTierDrafts(
                  ticketTypes.length > 0 ? ticketTypes : fallbackTicketTypes
                )
            : [],
        categories:
          nextType === 'competition' ? normalizedCompetitionCategories : [],
        contestants:
          nextType === 'competition'
            ? normalizedContestants.length > 0
              ? normalizedContestants
              : [emptyContestant()]
            : [],
        votePackages:
          nextType === 'competition'
            ? normalizedVotePackages.length > 0
              ? normalizedVotePackages
              : votePackageTemplates.length > 0
                ? votePackageTemplates
                : [emptyVotePackage()]
            : [],
        maxVotesPerTransaction: normalizedCompetitionMaxVotes,
        publicVoteDisplay: ['count', 'percent', 'hide'].includes(
          String(eventItem?.competition?.publicVoteDisplay || '')
            .trim()
            .toLowerCase()
        )
          ? String(eventItem?.competition?.publicVoteDisplay || '')
              .trim()
              .toLowerCase()
          : 'count',
      });

      setActivePanel('studio');
    },
    [ticketTypes, votePackageTemplates]
  );

  const deleteSubmission = useCallback(
    async (eventItem) => {
      if (!eventItem?._id) return;
      if (eventItem.status === 'approved') {
        setError('Approved events cannot be deleted from submissions.');
        setFeedback('');
        return;
      }

      const confirmed = window.confirm(
        `Delete submission \"${eventItem.title || 'this event'}\"? This action cannot be undone.`
      );
      if (!confirmed) return;

      setDeletingEventId(String(eventItem._id));
      setError('');
      setFeedback('');

      try {
        const response = await fetch(`/api/events/${eventItem._id}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (!response.ok || !data?.success) {
          setError(data?.message || 'Unable to delete event submission');
          return;
        }

        if (
          editingEventId &&
          String(editingEventId) === String(eventItem._id)
        ) {
          setEditingEventId('');
          resetStudioForm('ticketing');
          setBannerMeta(null);
          if (localPreviewUrlRef.current) {
            URL.revokeObjectURL(localPreviewUrlRef.current);
            localPreviewUrlRef.current = null;
          }
          setLocalBannerPreview('');
        }

        setFeedback(data?.message || 'Event submission deleted successfully.');
        await loadOrganizerData();
      } catch {
        setError('Delete request failed. Please try again.');
      } finally {
        setDeletingEventId('');
      }
    },
    [editingEventId, loadOrganizerData, resetStudioForm]
  );

  const saveManagedTicketTypes = async () => {
    const nextTypes = (managedTicketTypes || [])
      .map((item) => ({
        name: String(item?.name || '')
          .trim()
          .toLowerCase(),
        defaultPrice: Math.max(0, Number(item?.defaultPrice || 0)),
        defaultSlots: Math.max(0, Number(item?.defaultSlots || 0)),
        isActive: item?.isActive !== false,
      }))
      .filter((item) => item.name);

    if (nextTypes.length > 10) {
      setError('You can publish up to 10 ticket categories only.');
      setFeedback('');
      return;
    }

    if (nextTypes.length === 0) {
      setError('Add at least one ticket category before saving.');
      setFeedback('');
      return;
    }

    setSavingTicketTypes(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/organizer/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ticketTypes: nextTypes,
            votePackages: organizerSettingsSnapshot.votePackages || [],
            calendar: organizerSettingsSnapshot.calendar || {
              timezone: 'Africa/Nairobi',
              weekStartsOn: 'monday',
              defaultEventDurationHours: 4,
            },
          },
          promoters: organizerSettingsSnapshot.promoters || [],
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to save ticket categories');
        return;
      }

      setManagedTicketTypes(nextTypes);
      setTicketTypes(nextTypes.filter((item) => item.isActive !== false));
      setVotePackageTemplates(
        data.settings?.votePackages || votePackageTemplates
      );
      setOrganizerSettingsSnapshot((prev) => ({
        ...prev,
        votePackages: data.settings?.votePackages || prev.votePackages,
        calendar: data.settings?.calendar || prev.calendar,
      }));
      setFeedback('Ticket categories saved and published settings updated.');
      await loadOrganizerSettings();
    } catch {
      setError('Unable to save ticket categories right now.');
    } finally {
      setSavingTicketTypes(false);
    }
  };

  const submitFundRequest = async (event) => {
    event.preventDefault();
    setSubmittingFundRequest(true);
    setError('');
    setFeedback('');

    const mpesaNumber = normalizeMpesaNumber(fundRequestForm.mpesaNumber);
    const accountName = String(fundRequestForm.accountName || '').trim();
    const amount = Math.max(0, Number(fundRequestForm.amount || 0));
    const requestPurpose = String(fundRequestForm.requestPurpose || '').trim();
    const eventId = String(fundRequestForm.eventId || '').trim();

    if (!eventId) {
      setError('Select which event these funds are for.');
      setSubmittingFundRequest(false);
      return;
    }

    if (!mpesaNumber) {
      setError('Enter a valid M-PESA number in 07XXXXXXXX format.');
      setSubmittingFundRequest(false);
      return;
    }

    if (amount <= 0) {
      setError('Withdrawal amount must be greater than 0.');
      setSubmittingFundRequest(false);
      return;
    }

    if (amount > Number(fundsSnapshot.fundsAvailableForDisbursement || 0)) {
      setError(
        `Requested amount exceeds available funds for disbursement (${formatKsh(
          fundsSnapshot.fundsAvailableForDisbursement || 0
        )}).`
      );
      setSubmittingFundRequest(false);
      return;
    }

    try {
      const response = await fetch('/api/organizer/fund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          mpesaNumber,
          accountName,
          amount,
          requestPurpose,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to submit fund request');
        return;
      }

      setFeedback(data.message || 'Fund request submitted successfully.');
      setFundRequestForm(emptyFundRequest());
      await loadFundRequests();
    } catch {
      setError('Fund request submission failed. Please try again.');
    } finally {
      setSubmittingFundRequest(false);
    }
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setFeedback('');

    try {
      if (form.eventType === 'ticketing') {
        const tierNames = (form.tiers || [])
          .map((tier) =>
            String(tier?.name || '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean);
        if (new Set(tierNames).size !== tierNames.length) {
          setError('Each ticket type can only be selected once.');
          return;
        }
        if (
          (form.tiers || []).some((tier) => countWords(tier.description) > 1000)
        ) {
          setError('Each ticket description must be 1000 words or fewer.');
          return;
        }
      }

      if (form.eventType === 'competition') {
        const categories = (form.categories || [])
          .map((category) => String(category || '').trim())
          .filter(Boolean);
        if (categories.length < 1) {
          setError('Add at least one competition category.');
          return;
        }

        const validContestants = (form.contestants || []).filter(
          (item) =>
            String(item?.fullName || '').trim() &&
            String(item?.category || '').trim()
        );
        const categoryNames = new Set(
          categories.map((category) => category.toLowerCase())
        );
        const hasUnassignedContestant = (form.contestants || []).some(
          (item) =>
            String(item?.fullName || '').trim() &&
            !categoryNames.has(
              String(item?.category || '')
                .trim()
                .toLowerCase()
            )
        );
        if (hasUnassignedContestant) {
          setError('Select a category for every contestant.');
          return;
        }
        if (validContestants.length < 1) {
          setError('Add at least one contestant with name and category.');
          return;
        }

        const validPackages = (form.votePackages || []).filter(
          (item) =>
            String(item?.name || '').trim() &&
            Number(item?.votes || 0) > 0 &&
            Number(item?.price || 0) > 0 &&
            item?.isActive !== false
        );
        if (validPackages.length < 1) {
          setError(
            'Add at least one active vote package with votes and price.'
          );
          return;
        }

        if (normalizeCompetitionMaxVotes(form.maxVotesPerTransaction) < 1) {
          setError('Maximum votes per transaction must be at least 1.');
          return;
        }
      }

      const payload = {
        title: form.title,
        eventType: form.eventType,
        description: form.description,
        category: form.category,
        venue: form.venue,
        city: form.city,
        bannerUrl: form.bannerUrl,
        startDateTime: form.startDateTime,
        endDateTime: form.endDateTime,
        tiers: [
          ...(form.tiers || []).map((tier) => ({
            name: String(tier.name || '')
              .trim()
              .toLowerCase(),
            price: Number(tier.price || 0),
            totalSlots: Number(tier.totalSlots || 0),
          })),
        ],
        categories: (form.categories || []).map((category) =>
          String(category || '').trim()
        ),
        contestants: [
          ...(form.contestants || []).map((contestant) => ({
            fullName: String(contestant.fullName || '').trim(),
            profileImageUrl: String(contestant.profileImageUrl || '').trim(),
            category: String(contestant.category || '').trim(),
            votes: Math.max(0, Number(contestant.votes || 0)),
          })),
        ],
        votePackages: [
          ...(form.votePackages || []).map((pkg) => ({
            name: String(pkg.name || '').trim(),
            votes: Math.max(1, Number(pkg.votes || 1)),
            price: Math.max(1, Number(pkg.price || 0)),
            isActive: pkg.isActive !== false,
          })),
        ],
        maxVotesPerTransaction: normalizeCompetitionMaxVotes(
          form.maxVotesPerTransaction
        ),
        publicVoteDisplay: String(form.publicVoteDisplay || 'count').trim(),
      };

      const isEditing = Boolean(editingEventId);
      const endpoint = isEditing
        ? `/api/events/${editingEventId}`
        : '/api/events';

      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to submit event');
        return;
      }

      setFeedback(
        data.message ||
          (isEditing
            ? 'Event submission updated successfully.'
            : 'Event submitted for approval')
      );
      setEditingEventId('');
      resetStudioForm(form.eventType);
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
      setLocalBannerPreview('');
      setBannerMeta(null);
      await loadOrganizerData();
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const uploadBanner = async (file) => {
    if (!file) return;
    setError('');
    setFeedback('');

    if (!String(file.type || '').startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    if (file.size > MAX_BANNER_FILE_SIZE) {
      setError('Image must be 5MB or less.');
      return;
    }

    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }
    const previewUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = previewUrl;
    setLocalBannerPreview(previewUrl);

    let sourceWidth = 0;
    let sourceHeight = 0;
    try {
      const dimensions = await getImageDimensions(file);
      sourceWidth = dimensions.width;
      sourceHeight = dimensions.height;
    } catch {
      setError('Could not read image dimensions. Try another file.');
      return;
    }

    if (sourceWidth > MAX_BANNER_WIDTH || sourceHeight > MAX_BANNER_HEIGHT) {
      setError(
        `Image is ${sourceWidth}x${sourceHeight}px. Max allowed is ${MAX_BANNER_WIDTH}x${MAX_BANNER_HEIGHT}px.`
      );
      return;
    }

    setBannerMeta((prev) => ({
      ...(prev || {}),
      sourceWidth,
      sourceHeight,
      format: file.type?.split('/')[1] || 'unknown',
      bytes: file.size,
      maxWidth: MAX_BANNER_WIDTH,
      maxHeight: MAX_BANNER_HEIGHT,
    }));

    setUploadingBanner(true);

    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/uploads/banner', {
        method: 'POST',
        body,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Banner upload failed');
        return;
      }

      setForm((prev) => ({ ...prev, bannerUrl: data.bannerUrl }));
      setBannerMeta({
        width: data.width,
        height: data.height,
        sourceWidth,
        sourceHeight,
        format: data.format,
        bytes: data.bytes,
        folder: data.folder,
        maxWidth: data.maxWidth,
        maxHeight: data.maxHeight,
      });
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
      setLocalBannerPreview('');
      setFeedback('Banner uploaded successfully');
    } catch {
      setError('Banner upload request failed. Please try again.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const uploadContestantImage = async (file, idx) => {
    if (!file) return;
    setError('');
    setFeedback('');

    if (!String(file.type || '').startsWith('image/')) {
      setError('Please select a valid image file for contestant photo.');
      return;
    }

    if (file.size > MAX_BANNER_FILE_SIZE) {
      setError('Contestant image must be 5MB or less.');
      return;
    }

    setUploadingContestantKey(`contestant-${idx}`);
    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/uploads/contestant', {
        method: 'POST',
        body,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Contestant image upload failed');
        return false;
      }

      setForm((prev) => {
        const nextContestants = [...(prev.contestants || [])];
        if (!nextContestants[idx]) return prev;
        nextContestants[idx] = {
          ...nextContestants[idx],
          profileImageUrl: data.imageUrl,
        };
        return { ...prev, contestants: nextContestants };
      });

      setFeedback('Contestant image uploaded successfully.');
      return true;
    } catch {
      setError('Contestant image upload request failed. Please try again.');
      return false;
    } finally {
      setUploadingContestantKey('');
    }
  };

  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
    };
  }, []);

  const previewSource = localBannerPreview || form.bannerUrl;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card to-muted/30 p-6 shadow-sm md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-52 w-52 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Organizer Control Room
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Run campaigns, publish events, and track momentum in one modern
              workspace.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              This dashboard is now split into focused views so you can move
              fast without scrolling through everything at once.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-95">
            <button
              type="button"
              onClick={() => setActivePanel('studio')}
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Create Event
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActivePanel('submissions')}
              className="inline-flex items-center justify-center rounded-full border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/50"
            >
              View Submissions
            </button>
            <Link
              href="/organizer/settings"
              className="inline-flex items-center justify-center rounded-full border border-primary/45 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              <Settings className="mr-1.5 h-4 w-4" />
              Organizer Settings
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/50"
            >
              View Public Events
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          {[
            { key: 'overview', label: 'Overview', icon: Layers3 },
            { key: 'polls', label: 'Polls', icon: Vote },
            { key: 'tickets', label: 'Manage Tickets', icon: Ticket },
            { key: 'funds', label: 'Funds Request', icon: Wallet },
            { key: 'submissions', label: 'Submissions', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePanel(tab.key)}
              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                activePanel === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-background/70 text-foreground hover:border-primary/40'
              }`}
            >
              <tab.icon className="mr-1.5 h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activePanel === 'overview' ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-2xl border border-border bg-card/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Contestants Ranking List
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Event scope:{' '}
                    <span className="font-semibold text-foreground">
                      {activeEvent?.title || 'No active event selected'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedEventId}
                    onChange={(event) => setSelectedEventId(event.target.value)}
                    className="h-8 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground"
                    disabled={availableEvents.length === 0}
                  >
                    {availableEvents.length === 0 ? (
                      <option value="">No running approved events</option>
                    ) : null}
                    {availableEvents.map((item) => (
                      <option key={item.eventId} value={item.eventId}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handlePrintRanking}
                    className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50"
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={handleShareRanking}
                    className="inline-flex items-center rounded-full border border-primary/45 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Ranked from highest votes to lowest votes using paid competition
                vote transactions for the selected event only.
              </p>
              {rankingMessage ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {rankingMessage}
                </p>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                {contestantRanking.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background/30 p-4 text-sm text-muted-foreground">
                    No paid contestant voting data yet.
                  </div>
                ) : (
                  <table className="w-full min-w-150 border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">Rank</th>
                        <th className="px-3 py-2 font-semibold">
                          Contestant Name
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Number of Votes
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Amount of Money Used for Voting
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contestantRanking.map((row, index) => (
                        <tr
                          key={`${row.name}-${index}`}
                          className="border-b border-border/50"
                        >
                          <td className="px-3 py-2 font-semibold text-foreground">
                            #{index + 1}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {row.name}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground">
                            {row.votes.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground">
                            {formatKsh(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-linear-to-br from-card via-card/95 to-background p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Media Vault
              </p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Recent banners
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {mediaItems.length > 0
                  ? `${mediaItems.length} recent image${mediaItems.length === 1 ? '' : 's'} available.`
                  : 'No event banners yet. Upload from Create Event.'}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {mediaItems.length > 0 ? (
                  mediaItems.slice(0, 6).map((item) => (
                    <div
                      key={`media-${item._id}`}
                      className="relative aspect-4/3 overflow-hidden rounded-lg border border-border"
                    >
                      <Image
                        src={item.bannerUrl}
                        alt={item.title || 'Event banner'}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 rounded-lg border border-dashed border-border bg-background/30 p-4 text-center text-xs text-muted-foreground">
                    Empty media vault
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
            <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  Organizer Profile
                </h2>
                <Link
                  href="/organizer/settings"
                  className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50"
                >
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Configure settings
                </Link>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    Organization:
                  </span>{' '}
                  {organizerProfile?.organizationName || '-'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">
                    Contact:
                  </span>{' '}
                  {organizerProfile?.contactName || '-'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Email:</span>{' '}
                  {organizerProfile?.email || '-'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Phone:</span>{' '}
                  {organizerProfile?.phone || '-'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">County:</span>{' '}
                  {organizerProfile?.county || '-'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">
                    Subcounty:
                  </span>{' '}
                  {organizerProfile?.subCounty || '-'}
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Submission Feed
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">
                    Latest activity
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel('submissions')}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Open full list
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {recentSubmissions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-sm text-muted-foreground">
                    No submissions yet.
                  </div>
                ) : (
                  recentSubmissions.map((event) => (
                    <article
                      key={`latest-${event._id}`}
                      className="rounded-xl border border-border/70 bg-background/35 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {event.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.venue || 'Venue not set'} •{' '}
                            {new Date(event.startDateTime).toLocaleString()}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {String(event.eventType || 'ticketing')}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.11em] ${
                            event.status === 'approved'
                              ? 'bg-success/15 text-success'
                              : event.status === 'rejected'
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-warning/15 text-warning'
                          }`}
                        >
                          {event.status || 'pending'}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {activePanel === 'polls' ? (
        <section className="space-y-5 rounded-3xl border border-border bg-card/80 p-5 md:p-7">
          {organizerPollCopyToast ? (
            <div
              role="status"
              className="fixed right-4 top-4 z-50 rounded-lg border border-emerald-400/40 bg-emerald-950/95 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-lg"
            >
              {organizerPollCopyToast}
            </div>
          ) : null}

          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Event Polls
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">
                {activeEvent?.title || 'Select an event'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create and share polls for the selected event.
              </p>
            </div>
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              disabled={availableEvents.length === 0}
              aria-label="Event for polls"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {availableEvents.length === 0 ? (
                <option value="">No approved events available</option>
              ) : null}
              {availableEvents.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.title}
                </option>
              ))}
            </select>
          </header>

          {organizerPollMessage ? (
            <p className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
              {organizerPollMessage}
            </p>
          ) : null}

          {selectedEventId ? (
            <form
              className="rounded-xl border border-border/70 bg-background/40 p-4"
              onSubmit={submitOrganizerPoll}
            >
              <h3 className="text-lg font-semibold text-foreground">
                {editingOrganizerPollId ? 'Edit Poll' : 'Create Poll'}
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  required
                  minLength={2}
                  value={organizerPollForm.title}
                  onChange={(event) =>
                    setOrganizerPollForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Poll title"
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  required
                  value={organizerPollForm.description}
                  onChange={(event) =>
                    setOrganizerPollForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Short poll description"
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <label className="text-xs font-semibold text-muted-foreground">
                  Starts
                  <input
                    required
                    type="datetime-local"
                    value={organizerPollForm.startDateTime}
                    onChange={(event) =>
                      setOrganizerPollForm((previous) => ({
                        ...previous,
                        startDateTime: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground"
                  />
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Ends
                  <input
                    required
                    type="datetime-local"
                    value={organizerPollForm.endDateTime}
                    onChange={(event) =>
                      setOrganizerPollForm((previous) => ({
                        ...previous,
                        endDateTime: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    Contestants and categories
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setOrganizerPollForm((previous) => ({
                        ...previous,
                        nominees: [...previous.nominees, emptyPollNominee()],
                      }))
                    }
                    className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add contestant
                  </button>
                </div>
                {organizerPollForm.nominees.map((nominee, index) => (
                  <div
                    key={`poll-nominee-${index}`}
                    className="grid gap-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:grid-cols-3"
                  >
                    <input
                      required
                      minLength={2}
                      value={nominee.name}
                      onChange={(event) =>
                        setOrganizerPollForm((previous) => ({
                          ...previous,
                          nominees: previous.nominees.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder="Contestant name"
                      className="rounded-md border border-input bg-background px-2.5 py-2 text-sm"
                    />
                    <input
                      required
                      minLength={2}
                      value={nominee.category}
                      onChange={(event) =>
                        setOrganizerPollForm((previous) => ({
                          ...previous,
                          nominees: previous.nominees.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, category: event.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder="Category"
                      className="rounded-md border border-input bg-background px-2.5 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        value={nominee.imageUrl}
                        onChange={(event) =>
                          setOrganizerPollForm((previous) => ({
                            ...previous,
                            nominees: previous.nominees.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, imageUrl: event.target.value }
                                  : item
                            ),
                          }))
                        }
                        placeholder="Photo URL (optional)"
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={organizerPollForm.nominees.length <= 2}
                        onClick={() =>
                          setOrganizerPollForm((previous) => ({
                            ...previous,
                            nominees: previous.nominees.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          }))
                        }
                        aria-label={`Remove ${nominee.name || `contestant ${index + 1}`}`}
                        className="rounded-md border border-border px-2 text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={creatingOrganizerPoll || !activeEvent}
                className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingOrganizerPoll
                  ? 'Submitting...'
                  : editingOrganizerPollId
                    ? 'Save and Resubmit for Approval'
                    : 'Submit Poll for Approval'}
              </button>
              {editingOrganizerPollId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrganizerPollId('');
                    setOrganizerPollForm(emptyOrganizerPollForm());
                    setOrganizerPollMessage('');
                  }}
                  className="ml-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
                >
                  Cancel edit
                </button>
              ) : null}
            </form>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Select an approved event to create a poll.
            </p>
          )}

          <div>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              Polls for this event
            </h3>
            {loadingOrganizerPolls ? (
              <p className="text-sm text-muted-foreground">Loading polls...</p>
            ) : organizerPolls.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No polls have been created for this event yet.
              </p>
            ) : (
              <div className="space-y-3">
                {organizerPolls.map((poll) => {
                  const pollPath = `/voting/${poll._id}`;
                  const nominees = poll.contestants || poll.nominees || [];
                  const canDeletePoll = [
                    'draft',
                    'pending',
                    'archived',
                  ].includes(String(poll.status || ''));
                  return (
                    <article
                      key={poll._id}
                      className="rounded-xl border border-border/70 bg-background/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {poll.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {poll.status} · {nominees.length} contestants
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editOrganizerPoll(poll)}
                            aria-label={`Edit ${poll.title}`}
                            title="Edit poll"
                            className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {canDeletePoll ? (
                            <button
                              type="button"
                              onClick={() => deleteOrganizerPoll(poll._id)}
                              aria-label={`Delete ${poll.title}`}
                              title="Delete unpublished poll"
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                          <Link
                            href={pollPath}
                            target="_blank"
                            className="max-w-56 truncate text-xs text-primary underline underline-offset-2"
                          >
                            {pollPath}
                          </Link>
                          <button
                            type="button"
                            onClick={() => copyOrganizerPollLink(pollPath)}
                            aria-label="Copy general poll link"
                            title="Copy poll link"
                            className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {nominees.length > 0 ? (
                        <ul className="mt-3 divide-y divide-border/60">
                          {nominees.map((nominee) => {
                            const ticketPath = `/events/${encodeURIComponent(String(poll.eventId || selectedEventId))}?ref=${encodeURIComponent(String(nominee._id || ''))}`;
                            const contestantPath = `${pollPath}/contestants/${nominee._id}`;
                            const contestantSales = organizerTicketSales.filter(
                              (sale) =>
                                sale.eventId ===
                                  String(poll.eventId || selectedEventId) &&
                                sale.contestantId === String(nominee._id)
                            );

                            return (
                              <li
                                key={nominee._id}
                                className="space-y-2 py-2 text-sm"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate text-foreground">
                                    {nominee.name} ·{' '}
                                    {nominee.category || 'General'}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Link
                                      href={contestantPath}
                                      target="_blank"
                                      className="max-w-44 truncate text-xs text-primary underline underline-offset-2"
                                    >
                                      Voting profile
                                    </Link>
                                    <button
                                      type="button"
                                      aria-label={`Copy voting link for ${nominee.name}`}
                                      title="Copy contestant voting link"
                                      onClick={() =>
                                        copyOrganizerPollLink(contestantPath)
                                      }
                                      className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 border-t border-border/50 pt-2">
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    Ticket link
                                  </span>
                                  <Link
                                    href={ticketPath}
                                    target="_blank"
                                    className="min-w-0 flex-1 truncate text-xs text-primary underline underline-offset-2"
                                  >
                                    {ticketPath}
                                  </Link>
                                  <button
                                    type="button"
                                    aria-label={`Copy ticket sales link for ${nominee.name}`}
                                    title="Copy contestant ticket link"
                                    onClick={() =>
                                      copyOrganizerPollLink(ticketPath)
                                    }
                                    className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                </div>
                                {contestantSales.length > 0 ? (
                                  <div className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                      Ticket sales:{' '}
                                    </span>
                                    {contestantSales
                                      .map(
                                        (sale) =>
                                          `${sale.tierName}: ${Number(sale.tickets || 0)} sold (${formatKsh(sale.revenue)})`
                                      )
                                      .join(' · ')}
                                  </div>
                                ) : (
                                  <p className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
                                    No paid ticket sales from this link yet.
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activePanel === 'studio' ? (
        <section
          id="create-event"
          className="rounded-3xl border border-border bg-linear-to-br from-card via-card/95 to-background p-6 md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Create Event
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">
                  {editingEventId
                    ? 'Edit your existing submission.'
                    : 'Launch a standout event submission.'}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">
                  {editingEventId
                    ? 'Update details then save changes to send this event back for review.'
                    : 'Shape the story, add a strong banner, then choose whether this is a ticketing event or a competition with contestants.'}
                </p>
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEventId('');
                      setError('');
                      setFeedback('Edit mode canceled.');
                      resetStudioForm('ticketing');
                      setBannerMeta(null);
                      if (localPreviewUrlRef.current) {
                        URL.revokeObjectURL(localPreviewUrlRef.current);
                        localPreviewUrlRef.current = null;
                      }
                      setLocalBannerPreview('');
                    }}
                    className="mt-3 inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step 1
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Define the event basics
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step 2
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Upload visuals that sell the experience
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step 3
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Configure details and submit for approval
                  </p>
                </div>
              </div>
            </div>

            <form
              className="grid gap-4 rounded-2xl border border-border/70 bg-background/40 p-5 md:grid-cols-2"
              onSubmit={submitEvent}
            >
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Event title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Category"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                required
              />
              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.eventType}
                onChange={(e) => {
                  const nextType =
                    e.target.value === 'competition'
                      ? 'competition'
                      : 'ticketing';
                  setForm((prev) => ({
                    ...prev,
                    eventType: nextType,
                    tiers:
                      nextType === 'ticketing'
                        ? prev.tiers.length > 0
                          ? prev.tiers
                          : buildTierDrafts(
                              ticketTypes.length > 0
                                ? ticketTypes
                                : fallbackTicketTypes
                            )
                        : [],
                    contestants:
                      nextType === 'competition'
                        ? prev.contestants.length > 0
                          ? prev.contestants
                          : [emptyContestant()]
                        : [],
                    votePackages:
                      nextType === 'competition'
                        ? prev.votePackages.length > 0
                          ? prev.votePackages
                          : votePackageTemplates.length > 0
                            ? votePackageTemplates
                            : [emptyVotePackage()]
                        : [],
                  }));
                }}
              >
                <option value="ticketing">Ticketing Event</option>
                <option value="competition">Competition Event</option>
              </select>
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Venue"
                value={form.venue}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, venue: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="City"
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
                required
              />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Upload banner image
                </label>
                <ImageCropUploadField
                  label="Upload banner image"
                  helperText="Select an image to upload. Auto-cropped to 16:9 landscape."
                  disabled={uploadingBanner}
                  aspectRatio={16 / 9}
                  onCroppedFile={uploadBanner}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploadingBanner
                    ? 'Uploading banner...'
                    : previewSource
                      ? form.bannerUrl
                        ? 'Banner uploaded and linked to event.'
                        : 'Preview ready. Uploading selected image...'
                      : 'Upload an image to attach a banner to this event.'}
                </p>
                {previewSource ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background/60 p-3">
                    <div className="relative h-28 w-full overflow-hidden rounded-md">
                      <Image
                        src={previewSource}
                        alt="Banner preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <p>
                        Dimensions: {bannerMeta?.width || '?'} x{' '}
                        {bannerMeta?.height || '?'} px
                      </p>
                      <p>
                        Source: {bannerMeta?.sourceWidth || '?'} x{' '}
                        {bannerMeta?.sourceHeight || '?'} px
                      </p>
                      <p>
                        Policy: max {bannerMeta?.maxWidth || MAX_BANNER_WIDTH} x{' '}
                        {bannerMeta?.maxHeight || MAX_BANNER_HEIGHT} px
                      </p>
                      <p>
                        Format:{' '}
                        {String(bannerMeta?.format || 'unknown').toUpperCase()}{' '}
                        | Size:{' '}
                        {bannerMeta?.bytes
                          ? `${Math.round(bannerMeta.bytes / 1024)} KB`
                          : 'n/a'}
                      </p>
                      <p>
                        Folder:{' '}
                        {bannerMeta?.folder || 'nimblypolls/banners/general'}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" />
                    Upload Guidance
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Best results come from landscape banners with clear focal
                    subjects, strong contrast, and minimal text clutter.
                  </p>
                </div>
              </div>
              <textarea
                className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="Event description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                required
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.startDateTime}
                min={minStartDateTime}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    startDateTime: e.target.value,
                    endDateTime:
                      prev.endDateTime && prev.endDateTime < e.target.value
                        ? e.target.value
                        : prev.endDateTime,
                  }))
                }
                required
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.endDateTime}
                min={minEndDateTime}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endDateTime: e.target.value }))
                }
                required
              />

              {form.eventType === 'ticketing' ? (
                <div className="rounded-2xl border border-border bg-card/70 p-4 md:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Ticket Types (from organizer settings)
                    </p>
                    <Link
                      href="/organizer/settings"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Edit in settings
                    </Link>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(form.tiers || []).map((tier, idx) => {
                      const selectedInOtherRows = new Set(
                        (form.tiers || [])
                          .filter((_, rowIdx) => rowIdx !== idx)
                          .map((row) =>
                            String(row?.name || '')
                              .trim()
                              .toLowerCase()
                          )
                          .filter(Boolean)
                      );

                      return (
                        <div
                          key={`tier-${tier.name}-${idx}`}
                          className="rounded-xl border border-border/70 bg-background/40 p-3"
                        >
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Ticket type
                          </label>
                          <select
                            className="mb-2 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                            value={String(tier.name || '')
                              .trim()
                              .toLowerCase()}
                            onChange={(e) =>
                              setForm((prev) => {
                                const nextTiers = [...(prev.tiers || [])];
                                nextTiers[idx] = {
                                  ...nextTiers[idx],
                                  name: String(e.target.value || '')
                                    .trim()
                                    .toLowerCase(),
                                };
                                return { ...prev, tiers: nextTiers };
                              })
                            }
                            disabled={ticketTypes.length === 0}
                          >
                            {ticketTypes.length === 0 ? (
                              <option value="">
                                No ticket types configured
                              </option>
                            ) : null}
                            {ticketTypes.map((type, typeIdx) => {
                              const optionName = String(type?.name || '')
                                .trim()
                                .toLowerCase();
                              if (!optionName) return null;
                              return (
                                <option
                                  key={`tier-option-${optionName}-${typeIdx}`}
                                  value={optionName}
                                  disabled={selectedInOtherRows.has(optionName)}
                                >
                                  {optionName.replace(/-/g, ' ')}
                                </option>
                              );
                            })}
                            {String(tier.name || '').trim() &&
                            !ticketTypes.some(
                              (type) =>
                                String(type?.name || '')
                                  .trim()
                                  .toLowerCase() ===
                                String(tier.name || '')
                                  .trim()
                                  .toLowerCase()
                            ) ? (
                              <option
                                value={String(tier.name || '')
                                  .trim()
                                  .toLowerCase()}
                              >
                                {String(tier.name || '')
                                  .trim()
                                  .toLowerCase()
                                  .replace(/-/g, ' ')}
                              </option>
                            ) : null}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                              placeholder="Price KSH"
                              value={tier.price}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const nextTiers = [...(prev.tiers || [])];
                                  nextTiers[idx] = {
                                    ...nextTiers[idx],
                                    price: Number(e.target.value || 0),
                                  };
                                  return { ...prev, tiers: nextTiers };
                                })
                              }
                            />
                            <input
                              type="number"
                              min="0"
                              className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                              placeholder="Slots"
                              value={tier.totalSlots}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const nextTiers = [...(prev.tiers || [])];
                                  nextTiers[idx] = {
                                    ...nextTiers[idx],
                                    totalSlots: Number(e.target.value || 0),
                                  };
                                  return { ...prev, tiers: nextTiers };
                                })
                              }
                            />
                          </div>
                          <label className="mt-2 block text-xs font-semibold text-muted-foreground">
                            Ticket privileges and inclusions
                            <textarea
                              rows={3}
                              maxLength={20000}
                              value={tier.description || ''}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const nextTiers = [...(prev.tiers || [])];
                                  nextTiers[idx] = {
                                    ...nextTiers[idx],
                                    description: e.target.value,
                                  };
                                  return { ...prev, tiers: nextTiers };
                                })
                              }
                              className="mt-1 w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-sm font-normal text-foreground"
                              placeholder="For example: VIP seating, welcome drink, and buffet access"
                            />
                            <span className="mt-1 block text-right font-normal">
                              {countWords(tier.description)} / 1000 words
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {hasDuplicateTierSelections ? (
                    <p className="mt-2 text-xs text-destructive">
                      Choose each ticket type only once.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {form.eventType === 'competition' ? (
                <div className="space-y-3 md:col-span-2">
                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Competition Categories
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add a category for each competition within this event.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        placeholder="e.g. Best Artist of the Year"
                        value={newCompetitionCategory}
                        onChange={(event) =>
                          setNewCompetitionCategory(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const category = newCompetitionCategory.trim();
                          if (category.length < 2) {
                            setError(
                              'Enter a category name with at least 2 characters.'
                            );
                            return;
                          }
                          if (
                            (form.categories || []).some(
                              (item) =>
                                item.toLowerCase() === category.toLowerCase()
                            )
                          ) {
                            setError('That category has already been added.');
                            return;
                          }
                          setError('');
                          setForm((previous) => ({
                            ...previous,
                            categories: [
                              ...(previous.categories || []),
                              category,
                            ],
                          }));
                          setNewCompetitionCategory('');
                        }}
                        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Category
                      </button>
                    </div>
                    {(form.categories || []).length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {form.categories.map((category) => (
                          <li
                            key={category}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm"
                          >
                            <span>{category}</span>
                            <button
                              type="button"
                              aria-label={`Delete ${category}`}
                              title="Delete category"
                              onClick={() => {
                                setForm((previous) => ({
                                  ...previous,
                                  categories: (
                                    previous.categories || []
                                  ).filter((item) => item !== category),
                                  contestants: (previous.contestants || []).map(
                                    (contestant) =>
                                      String(
                                        contestant.category || ''
                                      ).toLowerCase() === category.toLowerCase()
                                        ? { ...contestant, category: '' }
                                        : contestant
                                  ),
                                }));
                              }}
                              className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Contestants
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            contestants: [
                              ...(prev.contestants || []),
                              emptyContestant(),
                            ],
                          }))
                        }
                        className="inline-flex items-center rounded-md border border-border bg-background/70 px-2.5 py-1.5 text-xs font-semibold text-foreground"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add contestant
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Add contestant name, upload profile image, category, and
                      Add contestant name, upload profile image, select a
                      category, and set opening votes.
                    </p>
                    <div className="space-y-3">
                      {(form.contestants || []).map((contestant, idx) => (
                        <div
                          key={`contestant-${idx}`}
                          className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-12"
                        >
                          <input
                            className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                            placeholder="Contestant name"
                            value={contestant.fullName}
                            onChange={(e) =>
                              setForm((prev) => {
                                const nextContestants = [
                                  ...(prev.contestants || []),
                                ];
                                nextContestants[idx] = {
                                  ...nextContestants[idx],
                                  fullName: e.target.value,
                                };
                                return {
                                  ...prev,
                                  contestants: nextContestants,
                                };
                              })
                            }
                            required
                          />
                          <div className="md:col-span-12">
                            <ImageCropUploadField
                              label="Contestant photo"
                              helperText={
                                uploadingContestantKey === `contestant-${idx}`
                                  ? 'Uploading contestant photo...'
                                  : 'Select a contestant photo to upload.'
                              }
                              disabled={
                                uploadingContestantKey === `contestant-${idx}`
                              }
                              onCroppedFile={(file) =>
                                uploadContestantImage(file, idx)
                              }
                            />
                            {contestant.profileImageUrl ? (
                              <div className="mt-2 flex items-center gap-2 text-xs text-success">
                                <Image
                                  src={contestant.profileImageUrl}
                                  alt={`${contestant.fullName || 'Contestant'} photo preview`}
                                  width={48}
                                  height={48}
                                  unoptimized
                                  className="h-12 w-12 rounded-md object-cover"
                                />
                                <span>Contestant photo saved.</span>
                              </div>
                            ) : null}
                          </div>
                          <select
                            className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                            value={contestant.category}
                            onChange={(event) =>
                              setForm((prev) => {
                                const nextContestants = [
                                  ...(prev.contestants || []),
                                ];
                                nextContestants[idx] = {
                                  ...nextContestants[idx],
                                  category: event.target.value,
                                };
                                return {
                                  ...prev,
                                  contestants: nextContestants,
                                };
                              })
                            }
                            required
                          >
                            <option value="" disabled>
                              Select Category
                            </option>
                            {(form.categories || []).map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2 md:col-span-2">
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                              placeholder="Votes"
                              value={contestant.votes}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const nextContestants = [
                                    ...(prev.contestants || []),
                                  ];
                                  nextContestants[idx] = {
                                    ...nextContestants[idx],
                                    votes: Math.max(
                                      0,
                                      Number(e.target.value || 0)
                                    ),
                                  };
                                  return {
                                    ...prev,
                                    contestants: nextContestants,
                                  };
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  contestants: (prev.contestants || []).filter(
                                    (_, rowIdx) => rowIdx !== idx
                                  ),
                                }))
                              }
                              className="rounded border border-border p-1.5 text-muted-foreground hover:text-destructive"
                              aria-label="Remove contestant"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Vote Packages
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            votePackages: [
                              ...(prev.votePackages || []),
                              emptyVotePackage(),
                            ],
                          }))
                        }
                        className="inline-flex items-center rounded-md border border-border bg-background/70 px-2.5 py-1.5 text-xs font-semibold text-foreground"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add package
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Define paid voting options for this competition. Example:
                      Basic (1 vote), Supporter (5 votes), Champion (10 votes).
                    </p>
                    <div className="mb-3 grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Max Votes Per Transaction
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                          value={Math.max(
                            1,
                            Number(form.maxVotesPerTransaction || 1)
                          )}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              maxVotesPerTransaction: Math.min(
                                10000,
                                Math.max(
                                  1,
                                  Math.round(Number(e.target.value || 1))
                                )
                              ),
                            }))
                          }
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Public voters can purchase up to this number of votes in
                        one checkout transaction for this event.
                      </p>
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Public Vote Display
                        <select
                          className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                          value={form.publicVoteDisplay || 'count'}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              publicVoteDisplay: e.target.value,
                            }))
                          }
                        >
                          <option value="count">Numerical Votes</option>
                          <option value="percent">Percentage (%)</option>
                          <option value="hide">Hide</option>
                        </select>
                      </label>
                    </div>
                    <div className="space-y-3">
                      {(form.votePackages || []).map((pkg, idx) => (
                        <div
                          key={`vote-package-${idx}`}
                          className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-12"
                        >
                          <input
                            className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-4"
                            placeholder="Package name"
                            value={pkg.name}
                            onChange={(e) =>
                              setForm((prev) => {
                                const nextPackages = [
                                  ...(prev.votePackages || []),
                                ];
                                nextPackages[idx] = {
                                  ...nextPackages[idx],
                                  name: e.target.value,
                                };
                                return { ...prev, votePackages: nextPackages };
                              })
                            }
                          />
                          <input
                            type="number"
                            min="1"
                            className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                            placeholder="Votes"
                            value={pkg.votes}
                            onChange={(e) =>
                              setForm((prev) => {
                                const nextPackages = [
                                  ...(prev.votePackages || []),
                                ];
                                nextPackages[idx] = {
                                  ...nextPackages[idx],
                                  votes: Math.max(
                                    1,
                                    Number(e.target.value || 1)
                                  ),
                                };
                                return { ...prev, votePackages: nextPackages };
                              })
                            }
                          />
                          <input
                            type="number"
                            min="1"
                            className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                            placeholder="Price (KSh)"
                            value={pkg.price}
                            onChange={(e) =>
                              setForm((prev) => {
                                const nextPackages = [
                                  ...(prev.votePackages || []),
                                ];
                                nextPackages[idx] = {
                                  ...nextPackages[idx],
                                  price: Math.max(
                                    1,
                                    Number(e.target.value || 1)
                                  ),
                                };
                                return { ...prev, votePackages: nextPackages };
                              })
                            }
                          />
                          <div className="flex items-center justify-between gap-2 md:col-span-3">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={pkg.isActive !== false}
                                onChange={(e) =>
                                  setForm((prev) => {
                                    const nextPackages = [
                                      ...(prev.votePackages || []),
                                    ];
                                    nextPackages[idx] = {
                                      ...nextPackages[idx],
                                      isActive: e.target.checked,
                                    };
                                    return {
                                      ...prev,
                                      votePackages: nextPackages,
                                    };
                                  })
                                }
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  votePackages: (
                                    prev.votePackages || []
                                  ).filter((_, rowIdx) => rowIdx !== idx),
                                }))
                              }
                              className="rounded border border-border p-1.5 text-muted-foreground hover:text-destructive"
                              aria-label="Remove vote package"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="text-sm text-destructive md:col-span-2">
                  {error}
                </p>
              ) : null}
              {feedback ? (
                <p className="text-sm text-success md:col-span-2">{feedback}</p>
              ) : null}
              <button
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 md:col-span-2 disabled:opacity-60"
                disabled={
                  loading ||
                  (form.eventType === 'ticketing' && hasDuplicateTierSelections)
                }
              >
                {loading
                  ? editingEventId
                    ? 'Saving changes...'
                    : 'Submitting...'
                  : editingEventId
                    ? 'Save Changes'
                    : 'Submit for Admin Approval'}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {activePanel === 'submissions' ? (
        <section className="rounded-3xl border border-border bg-card/80 p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Submission Pipeline
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                My Event Submissions
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Track each event as it moves through review, approval, or
                revision.
              </p>
            </div>
            <div className="rounded-full border border-border/70 bg-background/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {events.length} submission{events.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/40 p-5 text-sm text-muted-foreground">
                No event submissions yet. Open Create Event to create your first
                event.
              </div>
            ) : (
              events.map((event) => (
                <article
                  key={event._id}
                  className="rounded-2xl border border-border/70 bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.venue} •{' '}
                        {new Date(event.startDateTime).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Category: {event.category || 'General'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Type: {String(event.eventType || 'ticketing')}
                      </p>
                      {String(event.eventType || '') === 'competition' &&
                      (event.contestantStatus || []).length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Contestants:{' '}
                          {event.contestantStatus
                            .slice(0, 2)
                            .map(
                              (item) =>
                                `${item.fullName} (${item.status.replaceAll('_', ' ')})`
                            )
                            .join(' | ')}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${
                        event.status === 'approved'
                          ? 'bg-success/15 text-success'
                          : event.status === 'rejected'
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditingSubmission(event)}
                      disabled={event.status === 'approved'}
                      className="inline-flex items-center rounded-md border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSubmission(event)}
                      disabled={
                        event.status === 'approved' ||
                        deletingEventId === String(event._id)
                      }
                      className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingEventId === String(event._id)
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                    {event.status === 'approved' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => shareTicketLink(event)}
                          className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
                        >
                          <Share2 className="mr-1.5 h-3.5 w-3.5" />
                          Share Ticket Link
                        </button>
                        <p className="self-center text-[11px] text-muted-foreground">
                          Approved events are locked from organizer edits.
                        </p>
                      </>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activePanel === 'tickets' ? (
        <section className="rounded-3xl border border-border bg-card/80 p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Ticket Catalog
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Manage Tickets
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create, edit, and publish up to 10 ticket categories for your
                events.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {
                  managedTicketTypes.filter((item) => item.isActive !== false)
                    .length
                }{' '}
                published
              </span>
              <button
                type="button"
                onClick={() =>
                  setManagedTicketTypes((prev) =>
                    prev.length >= 10
                      ? prev
                      : [
                          ...prev,
                          {
                            name: '',
                            defaultPrice: 0,
                            defaultSlots: 0,
                            isActive: true,
                          },
                        ]
                  )
                }
                disabled={managedTicketTypes.length >= 10}
                className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Category
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(managedTicketTypes.length > 0
              ? managedTicketTypes
              : fallbackTicketTypes
            ).map((ticket, idx) => (
              <div
                key={`managed-ticket-${idx}`}
                className="grid gap-3 rounded-2xl border border-border/70 bg-background/40 p-4 md:grid-cols-12"
              >
                <input
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-4"
                  placeholder="Category name"
                  value={ticket.name}
                  onChange={(e) =>
                    setManagedTicketTypes((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], name: e.target.value };
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                  placeholder="Default price"
                  value={ticket.defaultPrice}
                  onChange={(e) =>
                    setManagedTicketTypes((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        ...next[idx],
                        defaultPrice: Number(e.target.value || 0),
                      };
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                  placeholder="Slots"
                  value={ticket.defaultSlots}
                  onChange={(e) =>
                    setManagedTicketTypes((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        ...next[idx],
                        defaultSlots: Number(e.target.value || 0),
                      };
                      return next;
                    })
                  }
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
                  <input
                    type="checkbox"
                    checked={ticket.isActive !== false}
                    onChange={(e) =>
                      setManagedTicketTypes((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...next[idx],
                          isActive: e.target.checked,
                        };
                        return next;
                      })
                    }
                  />
                  Publish
                </label>
                <div className="flex items-center justify-end md:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      setManagedTicketTypes((prev) =>
                        prev.filter((_, rowIdx) => rowIdx !== idx)
                      )
                    }
                    className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Events use the published categories above when building ticket
              tiers.
            </p>
            <button
              type="button"
              onClick={saveManagedTicketTypes}
              disabled={savingTicketTypes}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTicketTypes ? 'Saving...' : 'Save Ticket Catalog'}
            </button>
          </div>
        </section>
      ) : null}

      {activePanel === 'funds' ? (
        <section className="rounded-3xl border border-border bg-card/80 p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Disbursement Request
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Funds Request
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Request payout by entering recipient details, amount, and
                purpose.
              </p>

              <div className="mt-4 space-y-1 rounded-xl border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
                <p>
                  Organizer earnings:{' '}
                  <span className="font-semibold text-foreground">
                    {formatKsh(fundsSnapshot.organizerEarnings || 0)}
                  </span>
                </p>
                <p>
                  Reserved disbursements:{' '}
                  <span className="font-semibold text-foreground">
                    {formatKsh(fundsSnapshot.reservedDisbursementAmount || 0)}
                  </span>
                </p>
                <p>
                  Funds available for disbursement:{' '}
                  <span className="font-semibold text-success">
                    {formatKsh(
                      fundsSnapshot.fundsAvailableForDisbursement || 0
                    )}
                  </span>
                </p>
              </div>

              <form className="mt-5 space-y-3" onSubmit={submitFundRequest}>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Which event are these funds for?
                  </label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={fundRequestForm.eventId}
                    onChange={(e) =>
                      setFundRequestForm((prev) => ({
                        ...prev,
                        eventId: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select an event</option>
                    {events
                      .filter((item) => item.status === 'approved')
                      .map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                  {events.filter((item) => item.status === 'approved')
                    .length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No approved events yet. Funds can only be requested
                      against an approved event.
                    </p>
                  ) : null}
                </div>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="M-PESA number e.g. 07XXXXXXXX"
                  value={fundRequestForm.mpesaNumber}
                  onChange={(e) =>
                    setFundRequestForm((prev) => ({
                      ...prev,
                      mpesaNumber: e.target.value,
                    }))
                  }
                  required
                />
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Account name receiving disbursement"
                  value={fundRequestForm.accountName}
                  onChange={(e) =>
                    setFundRequestForm((prev) => ({
                      ...prev,
                      accountName: e.target.value,
                    }))
                  }
                />
                <input
                  type="number"
                  min="1"
                  max={Math.max(
                    1,
                    Math.floor(
                      Number(fundsSnapshot.fundsAvailableForDisbursement || 0)
                    )
                  )}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Amount to withdraw"
                  value={fundRequestForm.amount}
                  onChange={(e) =>
                    setFundRequestForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  required
                />
                <textarea
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Purpose / note for this disbursement"
                  value={fundRequestForm.requestPurpose}
                  onChange={(e) =>
                    setFundRequestForm((prev) => ({
                      ...prev,
                      requestPurpose: e.target.value,
                    }))
                  }
                  rows={3}
                />
                <button
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                  disabled={submittingFundRequest}
                >
                  {submittingFundRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  Recent Requests
                </h3>
                <span className="text-xs text-muted-foreground">
                  {fundRequests.length} total
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {fundRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No fund requests submitted yet.
                  </p>
                ) : (
                  fundRequests.map((request) => (
                    <article
                      key={request._id}
                      className="rounded-xl border border-border/70 bg-card/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {formatKsh(request.amount)}
                          </p>
                          {request.eventTitle ? (
                            <p className="text-xs font-semibold text-primary">
                              {request.eventTitle}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {request.mpesaNumber}
                          </p>
                          {request.accountName ? (
                            <p className="text-xs text-muted-foreground">
                              {request.accountName}
                            </p>
                          ) : null}
                          {request.requestPurpose ? (
                            <p className="text-xs text-muted-foreground">
                              {request.requestPurpose}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${
                            request.status === 'approved'
                              ? 'bg-success/15 text-success'
                              : request.status === 'rejected'
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-warning/15 text-warning'
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
