'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCcw, Search } from 'lucide-react';
import { formatKsh } from '@/lib/currency';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'paid', label: 'Paid' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All payment types' },
  { value: 'ticket', label: 'Ticket payments' },
  { value: 'campaign_vote', label: 'Campaign votes' },
  { value: 'competition_vote', label: 'Competition votes' },
];

function statusPillClass(status) {
  if (status === 'paid') return 'bg-success/15 text-success';
  if (status === 'failed') return 'bg-destructive/15 text-destructive';
  return 'bg-warning/15 text-warning';
}

function typeLabel(type) {
  if (type === 'campaign_vote') return 'Campaign Vote';
  if (type === 'competition_vote') return 'Competition Vote';
  return 'Ticket';
}

function safeDate(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

export function MpesaReconciliationPanel({
  title,
  subtitle,
  emptyMessage = 'No payment records found for this filter.',
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [canRecover, setCanRecover] = useState(false);
  const [actionId, setActionId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');

  const loadRecords = async (next = {}) => {
    const statusFilter = next.status !== undefined ? next.status : status;
    const typeFilter = next.type !== undefined ? next.type : type;
    const queryFilter = next.q !== undefined ? next.q : q;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (queryFilter.trim()) params.set('q', queryFilter.trim());

      const response = await fetch(
        `/api/payments/mpesa/reconciliation?${params.toString()}`,
        {
          cache: 'no-store',
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to load reconciliation records');
        setFeedback('');
        setItems([]);
        setSummary(null);
        setCanRecover(false);
        return;
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary || null);
      setCanRecover(data.canRecover === true);
      setFeedback('');
    } catch {
      setError('Unable to load reconciliation records right now.');
      setFeedback('');
      setItems([]);
      setSummary(null);
      setCanRecover(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords({});
  }, []);

  const summaryCards = useMemo(() => {
    const stats = summary || {
      total: 0,
      pending: 0,
      failed: 0,
      paid: 0,
      pendingAmount: 0,
      failedAmount: 0,
      paidAmount: 0,
    };

    return [
      {
        label: 'Pending',
        count: stats.pending,
        amount: stats.pendingAmount,
        className: 'text-warning',
      },
      {
        label: 'Failed',
        count: stats.failed,
        amount: stats.failedAmount,
        className: 'text-destructive',
      },
      {
        label: 'Recovered (Paid)',
        count: stats.paid,
        amount: stats.paidAmount,
        className: 'text-success',
      },
      {
        label: 'Total Tracked',
        count: stats.total,
        amount: stats.pendingAmount + stats.failedAmount + stats.paidAmount,
        className: 'text-primary',
      },
    ];
  }, [summary]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    await loadRecords({});
  };

  const recoverPayment = async (item) => {
    if (!item?.id || !item?.type) return;

    const confirmed = window.confirm(
      `Mark this ${typeLabel(item.type)} transaction as PAID and reconcile seats/votes?`
    );
    if (!confirmed) return;

    const receiptInput = window.prompt(
      'Optional: enter M-PESA receipt number for audit trail (leave blank to keep current value).',
      item.mpesaReceiptNumber || ''
    );

    const noteInput = window.prompt(
      'Optional: recovery note (for compliance/audit).',
      item.recoveryNote || ''
    );

    setActionId(`${item.type}-${item.id}`);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/payments/mpesa/reconciliation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type,
          id: item.id,
          mpesaReceiptNumber: receiptInput || '',
          recoveryNote: noteInput || '',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to recover transaction');
        return;
      }

      setFeedback(data.message || 'Transaction recovered successfully.');
      await loadRecords({});
    } catch {
      setError('Recovery request failed. Please try again.');
    } finally {
      setActionId('');
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-card/85 p-5"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${card.className}`}>
              {card.count}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatKsh(card.amount)}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card/85 p-5">
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={handleSearchSubmit}
        >
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all-statuses'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value || 'all-types'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="w-full bg-transparent outline-none"
              placeholder="Search phone, receipt, checkout id"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              disabled={loading}
            >
              <Activity className="h-4 w-4" />
              {loading ? 'Loading...' : 'Apply Filters'}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm"
              onClick={() => loadRecords({})}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {feedback ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {feedback}
        </p>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border border-border bg-card/85 p-2">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Title</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Qty/Votes</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Receipt</th>
              <th className="px-3 py-3">Checkout ID</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Result</th>
              <th className="px-3 py-3">Recovery Audit</th>
              {canRecover ? <th className="px-3 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  className="px-3 py-4 text-muted-foreground"
                  colSpan={canRecover ? 12 : 11}
                >
                  Loading reconciliation records...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-4 text-muted-foreground"
                  colSpan={canRecover ? 12 : 11}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={`${item.type}-${item.id}`}
                  className="border-b border-border/60"
                >
                  <td className="px-3 py-3 text-muted-foreground">
                    {safeDate(item.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {typeLabel(item.type)}
                  </td>
                  <td className="max-w-[220px] px-3 py-3 font-medium text-foreground">
                    <span className="line-clamp-2">{item.title || '-'}</span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatKsh(Number(item.amount || 0))}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {item.type === 'ticket'
                      ? Number(item.quantity || 0)
                      : Number(item.votes || 0)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {item.phone || '-'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {item.mpesaReceiptNumber || '-'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {item.checkoutRequestId || '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusPillClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-muted-foreground">
                    <span className="line-clamp-2">
                      {item.resultDesc || '-'}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-muted-foreground">
                    {item.recoveredBy ? (
                      <div className="space-y-0.5">
                        <p className="line-clamp-1 text-xs font-medium text-foreground">
                          {item.recoveredBy}
                        </p>
                        <p className="text-xs">{safeDate(item.recoveredAt)}</p>
                        {item.recoveryNote ? (
                          <p className="line-clamp-2 text-xs">
                            {item.recoveryNote}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs">-</span>
                    )}
                  </td>
                  {canRecover ? (
                    <td className="px-3 py-3">
                      {item.status === 'paid' ? (
                        <span className="text-xs font-medium text-success">
                          Reconciled
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md border border-success/50 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => recoverPayment(item)}
                          disabled={actionId === `${item.type}-${item.id}`}
                        >
                          {actionId === `${item.type}-${item.id}`
                            ? 'Recovering...'
                            : 'Recover'}
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
