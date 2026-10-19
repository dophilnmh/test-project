'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ShieldCheck, TicketX } from 'lucide-react';

const QR_READER_REGION_ID = 'organizer-ticket-qr-reader';

function playTone({ success = true } = {}) {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = success ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(success ? 880 : 220, ctx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.16);
    oscillator.onended = () => {
      try {
        ctx.close();
      } catch {}
    };
  } catch {}
}

function vibratePattern(pattern) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}

function parseTicketQrPayload(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const upper = value.toUpperCase();

  if (upper.startsWith('NIMBLYTICKET:') || upper.startsWith('NIMBLYTICKET|')) {
    const delimiter = value.includes('|') ? '|' : ':';
    const parts = value.split(delimiter);
    if (parts.length >= 3) {
      return {
        ticketCode: String(parts[1] || '')
          .trim()
          .toUpperCase(),
        entryCode: String(parts[2] || '')
          .replace(/\D+/g, '')
          .slice(0, 6),
      };
    }
  }

  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      const parsed = JSON.parse(value);
      const ticketCode = String(parsed?.ticketCode || '')
        .trim()
        .toUpperCase();
      const entryCode = String(parsed?.entryCode || '')
        .replace(/\D+/g, '')
        .slice(0, 6);
      if (ticketCode && entryCode) {
        return { ticketCode, entryCode };
      }
    } catch {}
  }

  try {
    const asUrl = new URL(value);
    const ticketCode = String(asUrl.searchParams.get('ticketCode') || '')
      .trim()
      .toUpperCase();
    const entryCode = String(asUrl.searchParams.get('entryCode') || '')
      .replace(/\D+/g, '')
      .slice(0, 6);
    if (ticketCode && entryCode) {
      return { ticketCode, entryCode };
    }
  } catch {}

  return null;
}

export default function OrganizerTicketVerifyPage() {
  const [ticketCode, setTicketCode] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [autoVerify, setAutoVerify] = useState(true);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPages, setAuditPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [exportingAuditFormat, setExportingAuditFormat] = useState('');
  const [auditFilters, setAuditFilters] = useState({
    outcome: '',
    verifier: '',
    ticketCode: '',
    from: '',
    to: '',
  });
  const scannerRef = useRef(null);
  const lastAutoVerifyKeyRef = useRef('');
  const scanInProgressRef = useRef(false);
  const lastFeedbackRef = useRef('');

  const playVerificationFeedback = ({
    status = 'invalid',
    dedupeKey = '',
  } = {}) => {
    if (!feedbackEnabled) return;

    const key = `${status}:${dedupeKey}`;
    if (lastFeedbackRef.current === key) return;
    lastFeedbackRef.current = key;

    if (status === 'verified') {
      playTone({ success: true });
      vibratePattern([160]);
      return;
    }

    playTone({ success: false });
    vibratePattern([160, 120, 160]);
  };

  const buildAuditQuery = ({ page = 1, forExport = false } = {}) => {
    const currentFilters = auditFilters;
    const params = new URLSearchParams();

    if (currentFilters.outcome) params.set('outcome', currentFilters.outcome);
    if (currentFilters.verifier)
      params.set('verifier', currentFilters.verifier);
    if (currentFilters.ticketCode)
      params.set('ticketCode', currentFilters.ticketCode.toUpperCase());
    if (currentFilters.from) params.set('from', currentFilters.from);
    if (currentFilters.to) params.set('to', currentFilters.to);

    if (forExport) {
      params.set('limit', '5000');
    } else {
      params.set('page', String(Math.max(1, Number(page || 1))));
      params.set('limit', '20');
    }

    return params;
  };

  const buildAuditQueryFromFilters = ({
    filters,
    page = 1,
    forExport = false,
  }) => {
    const params = new URLSearchParams();

    if (filters.outcome) params.set('outcome', filters.outcome);
    if (filters.verifier) params.set('verifier', filters.verifier);
    if (filters.ticketCode)
      params.set('ticketCode', filters.ticketCode.toUpperCase());
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    if (forExport) {
      params.set('limit', '5000');
    } else {
      params.set('page', String(Math.max(1, Number(page || 1))));
      params.set('limit', '20');
    }

    return params;
  };

  const loadAuditRows = async ({ page = 1 } = {}) => {
    setAuditLoading(true);
    setAuditError('');

    try {
      const params = buildAuditQuery({ page });
      const response = await fetch(
        `/api/organizer/tickets/verify/audits?${params.toString()}`,
        {
          cache: 'no-store',
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setAuditError(data?.message || 'Unable to load audit logs.');
        setAuditRows([]);
        setAuditPages(1);
        setAuditTotal(0);
        return;
      }

      setAuditRows(Array.isArray(data.items) ? data.items : []);
      setAuditPages(Math.max(1, Number(data.pages || 1)));
      setAuditTotal(Math.max(0, Number(data.total || 0)));
    } catch {
      setAuditError('Unable to load audit logs.');
      setAuditRows([]);
      setAuditPages(1);
      setAuditTotal(0);
    } finally {
      setAuditLoading(false);
    }
  };

  const downloadAuditExport = async (format) => {
    const selectedFormat = String(format || '').toLowerCase();
    if (!['csv', 'pdf'].includes(selectedFormat)) return;

    setExportingAuditFormat(selectedFormat);
    setAuditError('');

    try {
      const params = buildAuditQuery({ forExport: true });
      params.set('format', selectedFormat);

      const response = await fetch(
        `/api/organizer/tickets/verify/audits?${params.toString()}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        let message = 'Unable to export audit logs.';
        try {
          const data = await response.json();
          message = data?.message || message;
        } catch {}
        setAuditError(message);
        return;
      }

      const blob = await response.blob();
      const fileExt = selectedFormat === 'pdf' ? 'pdf' : 'csv';
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `ticket-verification-audits-${stamp}.${fileExt}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setAuditError('Unable to export audit logs.');
    } finally {
      setExportingAuditFormat('');
    }
  };

  const verifyTicketCodes = async ({
    ticketCode: nextTicketCode,
    entryCode: nextEntryCode,
    source = 'manual',
  }) => {
    const normalizedTicketCode = String(nextTicketCode || '')
      .trim()
      .toUpperCase();
    const normalizedEntryCode = String(nextEntryCode || '')
      .replace(/\D+/g, '')
      .slice(0, 6);

    if (!normalizedTicketCode || !normalizedEntryCode || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/organizer/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketCode: normalizedTicketCode,
          entryCode: normalizedEntryCode,
          source,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        const outcomeStatus =
          data?.errorCode === 'ALREADY_USED' ? 'already_used' : 'invalid';
        setError(data?.message || 'Unable to verify ticket');
        setResult({
          ...(data?.ticket || {}),
          ticketCode: data?.ticket?.ticketCode || normalizedTicketCode,
          status: outcomeStatus,
          audit: data?.audit || null,
        });
        playVerificationFeedback({
          status: outcomeStatus,
          dedupeKey: `${normalizedTicketCode}|${normalizedEntryCode}`,
        });
        setAuditPage(1);
        loadAuditRows({ page: 1 });
        return;
      }

      setResult({
        ...data.ticket,
        status: 'verified',
        audit: data?.audit || null,
      });
      playVerificationFeedback({
        status: 'verified',
        dedupeKey: `${normalizedTicketCode}|${normalizedEntryCode}`,
      });
      setAuditPage(1);
      loadAuditRows({ page: 1 });
      if (source === 'manual') {
        setTicketCode('');
        setEntryCode('');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
    } catch {}
    try {
      await scannerRef.current.clear();
    } catch {}
    scannerRef.current = null;
    setScanning(false);
  };

  const applyQrResult = async (decodedText) => {
    if (scanInProgressRef.current) return;
    scanInProgressRef.current = true;

    const parsed = parseTicketQrPayload(decodedText);
    if (!parsed?.ticketCode || !parsed?.entryCode) {
      setScannerError('QR code format not recognized for ticket verification.');
      playVerificationFeedback({
        status: 'invalid',
        dedupeKey: String(decodedText || '').slice(0, 80),
      });
      scanInProgressRef.current = false;
      return;
    }

    const scanKey = `${parsed.ticketCode}|${parsed.entryCode}`;
    if (lastAutoVerifyKeyRef.current === scanKey) {
      scanInProgressRef.current = false;
      return;
    }
    lastAutoVerifyKeyRef.current = scanKey;

    setTicketCode(parsed.ticketCode);
    setEntryCode(parsed.entryCode);
    setScannerError('');
    await stopScanner();

    if (autoVerify) {
      await verifyTicketCodes({
        ticketCode: parsed.ticketCode,
        entryCode: parsed.entryCode,
        source: 'scan',
      });
    }

    scanInProgressRef.current = false;
  };

  const startScanner = async () => {
    setScannerError('');
    lastAutoVerifyKeyRef.current = '';
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(QR_READER_REGION_ID);
      scannerRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (decodedText) => {
          applyQrResult(decodedText);
        },
        () => {}
      );
    } catch {
      setScannerError(
        'Unable to start camera scanner. You can upload a QR image instead.'
      );
      setScanning(false);
    }
  };

  const scanFromImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScannerError('');
    lastAutoVerifyKeyRef.current = '';
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const decodedText = await Html5Qrcode.scanFile(file, true);
      await applyQrResult(decodedText);
    } catch {
      setScannerError(
        'Could not read QR from image. Try another image or camera scan.'
      );
    }
  };

  useEffect(() => {
    loadAuditRows({ page: 1 });
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const verifyTicket = async (event) => {
    event.preventDefault();
    await verifyTicketCodes({ ticketCode, entryCode, source: 'manual' });
  };

  const handleAuditFilterSubmit = async (event) => {
    event.preventDefault();
    setAuditPage(1);
    await loadAuditRows({ page: 1 });
  };

  const handleAuditFilterReset = async () => {
    const cleared = {
      outcome: '',
      verifier: '',
      ticketCode: '',
      from: '',
      to: '',
    };
    setAuditFilters(cleared);
    setAuditPage(1);

    setAuditLoading(true);
    setAuditError('');
    try {
      const params = buildAuditQueryFromFilters({ filters: cleared, page: 1 });
      const response = await fetch(
        `/api/organizer/tickets/verify/audits?${params.toString()}`,
        {
          cache: 'no-store',
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setAuditError(data?.message || 'Unable to load audit logs.');
        setAuditRows([]);
        setAuditPages(1);
        setAuditTotal(0);
        return;
      }

      setAuditRows(Array.isArray(data.items) ? data.items : []);
      setAuditPages(Math.max(1, Number(data.pages || 1)));
      setAuditTotal(Math.max(0, Number(data.total || 0)));
    } catch {
      setAuditError('Unable to load audit logs.');
      setAuditRows([]);
      setAuditPages(1);
      setAuditTotal(0);
    } finally {
      setAuditLoading(false);
    }
  };

  const goToAuditPage = async (nextPage) => {
    const target = Math.min(Math.max(1, nextPage), auditPages);
    setAuditPage(target);
    await loadAuditRows({ page: target });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Entry Control
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          Verify Ticket at Gate
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask attendee for both the ticket code (from PDF) and the entry code
          sent by SMS.
        </p>

        <form
          className="mt-5 grid gap-3 sm:grid-cols-2"
          onSubmit={verifyTicket}
        >
          <div className="space-y-1 sm:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket Code
            </label>
            <input
              value={ticketCode}
              onChange={(event) =>
                setTicketCode(event.target.value.toUpperCase())
              }
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary/25 transition focus:ring-2"
              placeholder="NTP-XXXX-XXXXX"
              required
            />
          </div>

          <div className="space-y-1 sm:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SMS Entry Code
            </label>
            <input
              value={entryCode}
              onChange={(event) =>
                setEntryCode(event.target.value.replace(/\D+/g, '').slice(0, 6))
              }
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary/25 transition focus:ring-2"
              placeholder="6-digit code"
              required
              minLength={6}
              maxLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Verifying ticket...' : 'Verify Ticket'}
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            QR Scanner
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan the QR code from attendee PDF ticket to auto-fill ticket and
            entry codes.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-accent/20">
              <input
                type="checkbox"
                checked={autoVerify}
                onChange={(event) => setAutoVerify(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Auto Verify
            </label>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-accent/20">
              <input
                type="checkbox"
                checked={feedbackEnabled}
                onChange={(event) => setFeedbackEnabled(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Sound + Vibration
            </label>
            <button
              type="button"
              onClick={startScanner}
              disabled={scanning}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scanning ? 'Camera running...' : 'Start Camera Scan'}
            </button>
            <button
              type="button"
              onClick={stopScanner}
              disabled={!scanning}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Stop Camera
            </button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent/20">
              Scan QR Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={scanFromImage}
              />
            </label>
          </div>

          <div
            id={QR_READER_REGION_ID}
            className="mt-4 overflow-hidden rounded-lg"
          />

          {autoVerify ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Auto Verify is enabled. A valid QR scan will instantly verify the
              ticket.
            </p>
          ) : null}

          {feedbackEnabled ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Feedback enabled. Ticket recognized gives a single pulse. Any
              ticket not recognized gives a double pulse.
            </p>
          ) : null}

          {scannerError ? (
            <p className="mt-3 text-sm text-destructive">{scannerError}</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <TicketX className="h-4 w-4" />
            Verification failed
          </div>
          <p className="mt-2">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.status === 'verified'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800'
              : result.status === 'already_used'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-800'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result.status === 'verified' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {result.status === 'verified'
              ? 'Ticket accepted'
              : result.status === 'already_used'
                ? 'Ticket already used'
                : 'Ticket invalid'}
          </div>
          {result.eventTitle ? (
            <p className="mt-2">Event: {result.eventTitle}</p>
          ) : null}
          {result.tierName ? <p>Tier: {result.tierName}</p> : null}
          {typeof result.quantity === 'number' ? (
            <p>Quantity: {result.quantity}</p>
          ) : null}
          <p>Ticket Code: {result.ticketCode}</p>
          {result.audit?.outcome || result.audit?.checkedAt ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-80">
              Gate Log:{' '}
              {String(
                result.audit?.outcome || result.status || 'unknown'
              ).replaceAll('_', ' ')}{' '}
              at{' '}
              {result.audit?.checkedAt
                ? new Date(result.audit.checkedAt).toLocaleString()
                : '-'}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Dispute Audit Logs
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              Ticket Verification History
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by date, verifier, ticket code, or outcome and export
              dispute packs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadAuditExport('csv')}
              disabled={exportingAuditFormat === 'csv'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exportingAuditFormat === 'csv'
                ? 'Exporting CSV...'
                : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => downloadAuditExport('pdf')}
              disabled={exportingAuditFormat === 'pdf'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exportingAuditFormat === 'pdf'
                ? 'Exporting PDF...'
                : 'Export PDF'}
            </button>
          </div>
        </div>

        <form
          onSubmit={handleAuditFilterSubmit}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Outcome
            </span>
            <select
              value={auditFilters.outcome}
              onChange={(event) =>
                setAuditFilters((prev) => ({
                  ...prev,
                  outcome: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">All outcomes</option>
              <option value="verified">Verified</option>
              <option value="already_used">Already used</option>
              <option value="invalid_ticket">Invalid ticket</option>
              <option value="missing_fields">Missing fields</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Verifier
            </span>
            <input
              value={auditFilters.verifier}
              onChange={(event) =>
                setAuditFilters((prev) => ({
                  ...prev,
                  verifier: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="gate1@org.com"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket Code
            </span>
            <input
              value={auditFilters.ticketCode}
              onChange={(event) =>
                setAuditFilters((prev) => ({
                  ...prev,
                  ticketCode: event.target.value.toUpperCase(),
                }))
              }
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="NTP-XXXX-XXXXX"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <input
              type="datetime-local"
              value={auditFilters.from}
              onChange={(event) =>
                setAuditFilters((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              To
            </span>
            <input
              type="datetime-local"
              value={auditFilters.to}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, to: event.target.value }))
              }
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleAuditFilterReset}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-accent/20"
            >
              Reset
            </button>
            <p className="text-xs text-muted-foreground">
              Showing {auditRows.length} of {auditTotal} records
            </p>
          </div>
        </form>

        {auditError ? (
          <p className="mt-3 text-sm text-destructive">{auditError}</p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Checked At
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Outcome
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Ticket Code
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Verifier
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Event
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Tier
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Qty
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Source
                </th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {auditLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    Loading audit logs...
                  </td>
                </tr>
              ) : auditRows.length < 1 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No audit records found for current filters.
                  </td>
                </tr>
              ) : (
                auditRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {row.checkedAt
                        ? new Date(row.checkedAt).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {String(row.outcome || '-').replaceAll('_', ' ')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-foreground">
                      {row.ticketCode || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {row.verifier || '-'}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {row.eventTitle || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {row.tierName || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {Number(row.quantity || 0)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {row.requestSource || 'unknown'}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {row.message || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => goToAuditPage(auditPage - 1)}
            disabled={auditLoading || auditPage <= 1}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <p className="text-xs text-muted-foreground">
            Page {auditPage} of {auditPages}
          </p>
          <button
            type="button"
            onClick={() => goToAuditPage(auditPage + 1)}
            disabled={auditLoading || auditPage >= auditPages}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
