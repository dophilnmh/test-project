'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Ticket,
  Trophy,
  Vote,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatKsh } from '@/lib/currency';

export default function OrganizerAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeEvent, setActiveEvent] = useState(null);
  const [stats, setStats] = useState({
    collectedFunds: 0,
    soldTickets: 0,
    paidOrders: 0,
    competitionRevenue: 0,
    competitionVotes: 0,
    paidCompetitionTransactions: 0,
    totalRevenue: 0,
    platformCommission: 0,
    organizerEarnings: 0,
    fundsAvailableForDisbursement: 0,
  });
  const [eventRevenueBreakdown, setEventRevenueBreakdown] = useState([]);
  const [competitionAnalytics, setCompetitionAnalytics] = useState({
    byPackage: [],
    byContestant: [],
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const query = selectedEventId
          ? `?scope=analytics&eventId=${encodeURIComponent(selectedEventId)}`
          : '?scope=analytics';
        const response = await fetch(`/api/events/organizer${query}`, {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok || !data?.success) {
          setError(data.message || 'Unable to load analytics');
          return;
        }

        setEvents(Array.isArray(data.events) ? data.events : []);
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
        setStats(
          data.stats || {
            collectedFunds: 0,
            soldTickets: 0,
            paidOrders: 0,
            competitionRevenue: 0,
            competitionVotes: 0,
            paidCompetitionTransactions: 0,
            totalRevenue: 0,
            platformCommission: 0,
            organizerEarnings: 0,
            fundsAvailableForDisbursement: 0,
          }
        );
        setEventRevenueBreakdown(
          Array.isArray(data.approvedEventRevenueBreakdown)
            ? data.approvedEventRevenueBreakdown
            : []
        );
        setCompetitionAnalytics({
          byPackage: Array.isArray(data.competitionAnalytics?.byPackage)
            ? data.competitionAnalytics.byPackage
            : [],
          byContestant: Array.isArray(data.competitionAnalytics?.byContestant)
            ? data.competitionAnalytics.byContestant
            : [],
        });
      } catch {
        setError('Unable to load analytics right now.');
        setAvailableEvents([]);
        setActiveEvent(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedEventId]);

  const submissionSummary = useMemo(() => {
    const pending = events.filter((item) => item.status === 'pending').length;
    const approved = events.filter((item) => item.status === 'approved').length;
    const rejected = events.filter((item) => item.status === 'rejected').length;
    const total = events.length;

    return {
      pending,
      approved,
      rejected,
      total,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }, [events]);

  const statusChartData = useMemo(
    () => [
      { name: 'Pending', value: submissionSummary.pending, color: '#f59e0b' },
      { name: 'Approved', value: submissionSummary.approved, color: '#22c55e' },
      { name: 'Rejected', value: submissionSummary.rejected, color: '#ef4444' },
    ],
    [submissionSummary]
  );

  const categoryChartData = useMemo(() => {
    const grouped = new Map();
    for (const event of events) {
      const key = String(event.category || 'General').trim() || 'General';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [events]);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-linear-to-br from-card via-card/90 to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Analytics
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">
              Live organizer performance
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              These numbers are loaded from your selected event records and paid
              transactions.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Event scope:{' '}
              <span className="font-semibold text-foreground">
                {activeEvent?.title || 'No approved event selected'}
              </span>
            </p>
          </div>
          <select
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            className="h-9 min-w-64 rounded-full border border-border bg-background px-3 text-sm font-semibold text-foreground"
            disabled={availableEvents.length === 0}
          >
            {availableEvents.length === 0 ? (
              <option value="">No approved events</option>
            ) : null}
            {availableEvents.map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section
        aria-label="Sales and transaction cost summary"
        className="rounded-xl border border-border bg-card/80 p-4 md:p-5"
      >
        <h2 className="text-sm font-semibold text-foreground">
          Sales and Withdrawable Summary
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Total Sales
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {formatKsh(stats.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">
              All paid event transactions
            </p>
          </article>
          <article className="rounded-lg border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Transaction Cost
            </p>
            <p className="mt-1 text-xl font-bold text-destructive">
              {formatKsh(stats.platformCommission)}
            </p>
            <p className="text-xs text-muted-foreground">
              Fees from paid transactions
            </p>
          </article>
          <article className="rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Withdrawable Amount
            </p>
            <p className="mt-1 text-xl font-bold text-success">
              {formatKsh(
                Math.max(0, stats.totalRevenue - stats.platformCommission)
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Total sales minus transaction cost
            </p>
          </article>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Wallet className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Ticket Revenue
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(stats.collectedFunds)}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Ticket className="h-4 w-4 text-accent" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Sold Tickets
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {stats.soldTickets}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <CalendarClock className="h-4 w-4 text-warning" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Pending Events
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {submissionSummary.pending}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <BarChart3 className="h-4 w-4 text-success" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Approval Rate
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {submissionSummary.approvalRate}%
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Trophy className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Competition Revenue
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(stats.competitionRevenue)}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Vote className="h-4 w-4 text-accent" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Paid Competition Votes
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {stats.competitionVotes}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Wallet className="h-4 w-4 text-success" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Total Revenue
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(stats.totalRevenue)}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Wallet className="h-4 w-4 text-destructive" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Platform Commission
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(stats.platformCommission)}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Wallet className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Organizer Earnings
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(stats.organizerEarnings)}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Wallet className="h-4 w-4 text-success" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Funds Available For Disbursement
          </p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(stats.fundsAvailableForDisbursement)}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <h2 className="text-xl font-semibold text-foreground">
          Transparent Revenue Split (Approved Events)
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Total Revenue -&gt; Platform Commission -&gt; Organizer Earnings -&gt;
          Funds Available for Disbursement.
        </p>
        {eventRevenueBreakdown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No approved event revenue data yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2">Event</th>
                  <th className="px-2 py-2 text-right">Competition Revenue</th>
                  <th className="px-2 py-2 text-right">
                    Paid Competition Votes
                  </th>
                  <th className="px-2 py-2 text-right">Total Revenue</th>
                  <th className="px-2 py-2 text-right">Organizer Earnings</th>
                  <th className="px-2 py-2 text-right">Platform Commission</th>
                  <th className="px-2 py-2 text-right">
                    Funds Available for Disbursement
                  </th>
                </tr>
              </thead>
              <tbody>
                {eventRevenueBreakdown.map((row) => (
                  <tr key={row.eventId} className="border-b border-border/60">
                    <td className="px-2 py-2">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.startDateTime
                          ? new Date(row.startDateTime).toLocaleString()
                          : 'Date TBD'}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatKsh(row.competitionRevenue)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.paidCompetitionVotes || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-foreground">
                      {formatKsh(row.totalRevenue)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatKsh(row.organizerEarnings)}
                    </td>
                    <td className="px-2 py-2 text-right text-destructive">
                      {formatKsh(row.platformCommission)}
                    </td>
                    <td className="px-2 py-2 text-right text-success">
                      {formatKsh(row.fundsAvailableForDisbursement)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <h2 className="text-xl font-semibold text-foreground">
          Submission Breakdown
        </h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
            Approved:{' '}
            <span className="font-semibold text-foreground">
              {submissionSummary.approved}
            </span>
          </p>
          <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
            Rejected:{' '}
            <span className="font-semibold text-foreground">
              {submissionSummary.rejected}
            </span>
          </p>
          <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
            Paid Ticket Orders:{' '}
            <span className="font-semibold text-foreground">
              {stats.paidOrders}
            </span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <h2 className="text-xl font-semibold text-foreground">
          Competition Checkout Summary
        </h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
            Paid Vote Transactions:{' '}
            <span className="font-semibold text-foreground">
              {stats.paidCompetitionTransactions}
            </span>
          </p>
          <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
            Total Paid Votes:{' '}
            <span className="font-semibold text-foreground">
              {stats.competitionVotes}
            </span>
          </p>
          <p className="rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
            Revenue from Competition Votes:{' '}
            <span className="font-semibold text-foreground">
              {formatKsh(stats.competitionRevenue)}
            </span>
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Event Status Distribution
          </h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Events by Category
          </h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.2)"
                />
                <XAxis
                  dataKey="name"
                  stroke="rgba(148,163,184,0.9)"
                  fontSize={12}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="rgba(148,163,184,0.9)"
                  fontSize={12}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#00e5c0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Competition Revenue by Package
          </h3>
          {competitionAnalytics.byPackage.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No paid competition package data yet.
            </p>
          ) : (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={competitionAnalytics.byPackage.slice(0, 8)}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.2)"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(148,163,184,0.9)"
                    fontSize={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="rgba(148,163,184,0.9)"
                    fontSize={12}
                  />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Top Contestants by Paid Votes
          </h3>
          {competitionAnalytics.byContestant.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No contestant vote performance data yet.
            </p>
          ) : (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={competitionAnalytics.byContestant
                    .slice(0, 8)
                    .map((item) => ({
                      ...item,
                      label: `${item.name} (${item.category})`,
                    }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.2)"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(148,163,184,0.9)"
                    fontSize={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="rgba(148,163,184,0.9)"
                    fontSize={12}
                  />
                  <Tooltip />
                  <Bar dataKey="votes" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
