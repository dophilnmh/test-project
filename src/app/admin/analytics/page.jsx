'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatKsh } from '@/lib/currency';

const RANGE_OPTIONS = ['today', '7d', '30d', '90d', 'this_month', 'custom'];

function toDateInputValue(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getRangeQuery(rangeKey, customFrom, customTo) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (rangeKey === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '7d') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '30d') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '90d') {
    start.setDate(start.getDate() - 89);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === 'this_month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    const cFrom = customFrom ? new Date(customFrom) : null;
    const cTo = customTo ? new Date(customTo) : null;
    if (
      !cFrom ||
      Number.isNaN(cFrom.getTime()) ||
      !cTo ||
      Number.isNaN(cTo.getTime())
    ) {
      return '';
    }
    cFrom.setHours(0, 0, 0, 0);
    cTo.setHours(23, 59, 59, 999);
    return `?from=${encodeURIComponent(cFrom.toISOString())}&to=${encodeURIComponent(cTo.toISOString())}`;
  }

  return `?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
}

function toCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState({
    totalFunds: 0,
    totalTickets: 0,
    totalOrders: 0,
    totalEvents: 0,
    ticketPlatformEarnings: 0,
    ticketOrganizerEarnings: 0,
    ticketProceedsByEvent: [],
    merchPlatformEarnings: 0,
    votingPlatformEarnings: 0,
    totalPlatformEarnings: 0,
    votingCampaignPlatformEarnings: 0,
    votingCompetitionPlatformEarnings: 0,
    votingProceedsByEvent: [],
  });
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeRange, setActiveRange] = useState({ from: null, to: null });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const query = getRangeQuery(rangeKey, customFrom, customTo);
    if (rangeKey === 'custom' && !query) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/analytics/summary${query}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setSummary(
          data.summary || {
            totalFunds: 0,
            totalTickets: 0,
            totalOrders: 0,
            totalEvents: 0,
            ticketPlatformEarnings: 0,
            ticketOrganizerEarnings: 0,
            ticketProceedsByEvent: [],
            merchPlatformEarnings: 0,
            votingPlatformEarnings: 0,
            totalPlatformEarnings: 0,
            votingCampaignPlatformEarnings: 0,
            votingCompetitionPlatformEarnings: 0,
            votingProceedsByEvent: [],
          }
        );
        setActiveRange({
          from: data?.range?.from || null,
          to: data?.range?.to || null,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [rangeKey, customFrom, customTo]);

  useEffect(() => {
    if (rangeKey !== 'custom') {
      loadSummary();
      return;
    }
    if (customFrom && customTo) {
      loadSummary();
    }
  }, [loadSummary, rangeKey, customFrom, customTo]);

  useEffect(() => {
    if (rangeKey === 'custom') return;

    const now = new Date();
    if (rangeKey === 'today') {
      setCustomFrom(toDateInputValue(now));
      setCustomTo(toDateInputValue(now));
      return;
    }
    if (rangeKey === '7d') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setCustomFrom(toDateInputValue(start));
      setCustomTo(toDateInputValue(now));
      return;
    }

    if (rangeKey === '90d') {
      const start = new Date(now);
      start.setDate(now.getDate() - 89);
      setCustomFrom(toDateInputValue(start));
      setCustomTo(toDateInputValue(now));
      return;
    }

    if (rangeKey === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setCustomFrom(toDateInputValue(start));
      setCustomTo(toDateInputValue(now));
      return;
    }

    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    setCustomFrom(toDateInputValue(start));
    setCustomTo(toDateInputValue(now));
  }, [rangeKey]);

  const periodLabel = useMemo(() => {
    const fromLabel = activeRange.from
      ? new Date(activeRange.from).toLocaleDateString()
      : '-';
    const toLabel = activeRange.to
      ? new Date(activeRange.to).toLocaleDateString()
      : '-';
    return `${fromLabel} to ${toLabel}`;
  }, [activeRange.from, activeRange.to]);

  const exportCsv = () => {
    const rows = [
      ['Period From', activeRange.from || ''],
      ['Period To', activeRange.to || ''],
      ['Source', 'Platform Earnings (KSH)'],
      ['Merchandise', Number(summary.merchPlatformEarnings || 0)],
      [
        'Voting - Campaigns',
        Number(summary.votingCampaignPlatformEarnings || 0),
      ],
      [
        'Voting - Competitions',
        Number(summary.votingCompetitionPlatformEarnings || 0),
      ],
      ['Voting - Total', Number(summary.votingPlatformEarnings || 0)],
      ['Platform Total', Number(summary.totalPlatformEarnings || 0)],
    ];

    const csv = rows.map((row) => row.map(toCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-earnings-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">
        Ticketing Analytics
      </h1>
      <p className="text-sm text-muted-foreground">
        Monitor revenue, event performance, conversion, and capacity trends from
        one dashboard.
      </p>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Platform Earnings by Source
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Period: {periodLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRangeKey(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                  rangeKey === option
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-foreground'
                }`}
              >
                {option === 'today'
                  ? 'Today'
                  : option === '7d'
                    ? '7d'
                    : option === '30d'
                      ? '30d'
                      : option === '90d'
                        ? '90d'
                        : option === 'this_month'
                          ? 'This Month'
                          : 'Custom'}
              </button>
            ))}
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-foreground"
            >
              Export CSV
            </button>
          </div>
        </div>

        {rangeKey === 'custom' ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:max-w-md">
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        {loading ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Loading selected range...
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-border bg-background/50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Tickets
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKsh(summary.ticketPlatformEarnings)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Platform commission · Organizer share:{' '}
              {formatKsh(summary.ticketOrganizerEarnings)}
            </p>
          </article>

          <article className="rounded-xl border border-border bg-background/50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Merchandise
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKsh(summary.merchPlatformEarnings)}
            </p>
          </article>

          <article className="rounded-xl border border-border bg-background/50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Voting
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKsh(summary.votingPlatformEarnings)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Campaigns: {formatKsh(summary.votingCampaignPlatformEarnings)} |
              Competitions:{' '}
              {formatKsh(summary.votingCompetitionPlatformEarnings)}
            </p>
          </article>

          <article className="rounded-xl border border-primary/40 bg-primary/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-primary">
              Total Platform Earnings
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {formatKsh(summary.totalPlatformEarnings)}
            </p>
          </article>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <div className="border-b border-border bg-background/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Ticket Proceeds by Event
            </h3>
          </div>
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Ticket Sales</th>
                <th className="px-4 py-3">Tickets / Orders</th>
                <th className="px-4 py-3">Platform Earnings</th>
                <th className="px-4 py-3">Organizer Earnings</th>
              </tr>
            </thead>
            <tbody>
              {(summary.ticketProceedsByEvent || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-muted-foreground">
                    No paid ticket proceeds in this period.
                  </td>
                </tr>
              ) : (
                summary.ticketProceedsByEvent.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.organizerName || 'Unassigned organizer'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {formatKsh(row.ticketRevenue)}
                    </td>
                    <td className="px-4 py-3">
                      {Number(row.tickets || 0).toLocaleString()} /{' '}
                      {Number(row.orders || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {formatKsh(row.platformCommission)}
                    </td>
                    <td className="px-4 py-3">
                      {formatKsh(row.organizerEarnings)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <div className="border-b border-border bg-background/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Voting Proceeds by Event
            </h3>
          </div>
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Vote Funds</th>
                <th className="px-4 py-3">Votes</th>
                <th className="px-4 py-3">Platform Commission</th>
                <th className="px-4 py-3">Organizer Earnings</th>
              </tr>
            </thead>
            <tbody>
              {(summary.votingProceedsByEvent || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-muted-foreground">
                    No paid voting proceeds in this period.
                  </td>
                </tr>
              ) : (
                summary.votingProceedsByEvent.map((row) => (
                  <tr
                    key={`${row.type}-${row.id}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.organizerName || 'Unassigned organizer'} ·{' '}
                        {row.type}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {formatKsh(row.totalVoteFunds)}
                    </td>
                    <td className="px-4 py-3">
                      {Number(row.votes || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {formatKsh(row.platformCommission)}
                    </td>
                    <td className="px-4 py-3">
                      {formatKsh(row.organizerEarnings)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Collected Funds</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatKsh(summary.totalFunds)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Tickets Sold</p>
          <p className="mt-2 text-2xl font-semibold">{summary.totalTickets}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Paid Orders</p>
          <p className="mt-2 text-2xl font-semibold">{summary.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Approved Events</p>
          <p className="mt-2 text-2xl font-semibold">{summary.totalEvents}</p>
        </div>
      </div>
    </section>
  );
}
