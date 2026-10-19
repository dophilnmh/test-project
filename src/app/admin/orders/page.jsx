'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatKsh } from '@/lib/currency';

const ORDER_STATUSES = ['all', 'pending', 'paid', 'failed'];
const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: PAGE_SIZE,
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        status,
      });
      if (query.trim()) {
        params.set('q', query.trim());
      }

      const response = await fetch(`/api/orders?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to load orders');
        return;
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setPagination(
        data.pagination || {
          page: 1,
          totalPages: 1,
          total: 0,
          limit: PAGE_SIZE,
        }
      );
    } catch {
      setError('Unable to load orders right now.');
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Ticket Orders</h1>
      <p className="text-sm text-muted-foreground">
        Track purchases, payment confirmations, and attendee records across all
        approved events.
      </p>

      <div className="grid gap-3 rounded-xl border border-border bg-card/80 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
        <input
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Search event, tier, seller, phone, or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {ORDER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {pagination.total} result{pagination.total === 1 ? '' : 's'}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card/80 p-4 text-sm text-muted-foreground">
          Loading orders...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-3">Event</th>
              <th className="px-3 py-3">Tier</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Unit Price</th>
              <th className="px-3 py-3">Order Total</th>
              <th className="px-3 py-3">Sold By</th>
              <th className="px-3 py-3">Buyer</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && !loading ? (
              <tr>
                <td
                  className="px-3 py-4 text-sm text-muted-foreground"
                  colSpan={9}
                >
                  No orders match this filter.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    {order.eventId?.title || order.eventTitle}
                  </td>
                  <td className="px-3 py-3">{order.tierName}</td>
                  <td className="px-3 py-3">{order.quantity}</td>
                  <td className="px-3 py-3">{formatKsh(order.unitPrice)}</td>
                  <td className="px-3 py-3">{formatKsh(order.totalAmount)}</td>
                  <td className="px-3 py-3">
                    {order.referralContestantName || 'General'}
                  </td>
                  <td className="px-3 py-3">
                    {order.customerPhone || order.customerEmail || '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        order.status === 'paid'
                          ? 'bg-success/15 text-success'
                          : order.status === 'failed'
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          type="button"
          onClick={() =>
            setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))
          }
          disabled={page >= (pagination.totalPages || 1)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
