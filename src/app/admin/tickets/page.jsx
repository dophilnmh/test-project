'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatKsh } from '@/lib/currency';

const PAGE_SIZE = 8;
const EVENT_PAGE_SIZE = 6;
const FILTER_OPTIONS = ['all', 'low_stock', 'sold_out', 'active'];

export default function AdminTicketsPage() {
  const [events, setEvents] = useState([]);
  const [eventPagination, setEventPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: EVENT_PAGE_SIZE,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [eventQuery, setEventQuery] = useState('');
  const [savingEventId, setSavingEventId] = useState('');
  const [deletingEventId, setDeletingEventId] = useState('');

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams({
      scope: 'admin',
      page: String(eventPage),
      limit: String(EVENT_PAGE_SIZE),
    });

    if (eventQuery.trim()) {
      params.set('q', eventQuery.trim());
    }

    const response = await fetch(`/api/events?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = await response.json();

    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Unable to load events');
    }

    setEvents(Array.isArray(data.events) ? data.events : []);
    setEventPagination(
      data.pagination || {
        page: 1,
        totalPages: 1,
        total: 0,
        limit: EVENT_PAGE_SIZE,
      }
    );
  }, [eventPage, eventQuery]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const ordersResponse = await fetch('/api/orders', {
          cache: 'no-store',
        });
        const ordersData = await ordersResponse.json();

        if (!ordersResponse.ok || !ordersData?.success) {
          setError(ordersData?.message || 'Unable to load ticket orders');
          return;
        }

        await loadEvents();
        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      } catch (loadError) {
        setError(
          loadError.message || 'Unable to load ticket health data right now.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadEvents]);

  const totals = useMemo(() => {
    const tierRows = [];

    for (const event of events) {
      const tiers = Array.isArray(event?.tiers) ? event.tiers : [];

      for (const tier of tiers) {
        const totalSlots = Number(tier?.totalSlots || 0);
        const remainingSlots = Number(tier?.remainingSlots || 0);
        const soldSlots = Math.max(0, totalSlots - remainingSlots);
        const price = Number(tier?.price || 0);

        tierRows.push({
          eventId: event._id,
          eventTitle: event.title,
          eventStatus: event.status || 'draft',
          tierName: tier.name,
          totalSlots,
          remainingSlots,
          soldSlots,
          price,
          stockHealth:
            remainingSlots <= 0
              ? 'sold_out'
              : remainingSlots <= Math.max(5, Math.ceil(totalSlots * 0.1))
                ? 'low_stock'
                : 'active',
        });
      }
    }

    const totalSeatsLeft = tierRows.reduce(
      (sum, row) => sum + row.remainingSlots,
      0
    );
    const totalSoldSeats = tierRows.reduce(
      (sum, row) => sum + row.soldSlots,
      0
    );
    const totalCapacity = tierRows.reduce(
      (sum, row) => sum + row.totalSlots,
      0
    );
    const totalRevenuePotential = tierRows.reduce(
      (sum, row) => sum + row.price * row.remainingSlots,
      0
    );
    const realizedRevenue = orders
      .filter((order) => order.status === 'paid')
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const lowStockRows = tierRows.filter(
      (row) => row.stockHealth === 'low_stock'
    );
    const soldOutRows = tierRows.filter(
      (row) => row.stockHealth === 'sold_out'
    );

    return {
      tierRows,
      totalSeatsLeft,
      totalSoldSeats,
      totalCapacity,
      totalRevenuePotential,
      realizedRevenue,
      lowStockRows,
      soldOutRows,
    };
  }, [events, orders]);

  const filteredRows = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    return totals.tierRows.filter((row) => {
      const matchesQuery =
        !searchTerm ||
        [row.eventTitle, row.tierName, row.eventStatus]
          .join(' ')
          .toLowerCase()
          .includes(searchTerm);

      const matchesFilter =
        statusFilter === 'all' || row.stockHealth === statusFilter;

      return matchesQuery && matchesFilter;
    });
  }, [query, statusFilter, totals.tierRows]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const lowStockCount = totals.lowStockRows.length;
  const soldOutCount = totals.soldOutRows.length;

  const updateEventStatus = async (eventId, nextStatus) => {
    setSavingEventId(eventId);
    setError('');

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to update event');
      }

      await loadEvents();
    } catch (updateError) {
      setError(updateError.message || 'Unable to update event');
    } finally {
      setSavingEventId('');
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event permanently?')) return;

    setDeletingEventId(eventId);
    setError('');

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to delete event');
      }

      await loadEvents();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete event');
    } finally {
      setDeletingEventId('');
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticket Health</h1>
          <p className="text-sm text-muted-foreground">
            Monitor available inventory, revenue, and stock risk across all
            approved events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card/85 p-5">
          <p className="text-sm text-muted-foreground">Total Seats Remaining</p>
          <p className="text-3xl font-semibold text-foreground">
            {totals.totalSeatsLeft.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sold {totals.totalSoldSeats.toLocaleString()} of{' '}
            {totals.totalCapacity.toLocaleString()} total capacity
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/85 p-5">
          <p className="text-sm text-muted-foreground">
            Projected Revenue (KSH)
          </p>
          <p className="text-3xl font-semibold text-foreground">
            {formatKsh(totals.totalRevenuePotential)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Realized paid revenue: {formatKsh(totals.realizedRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/85 p-5">
          <p className="text-sm text-muted-foreground">Low-stock tiers</p>
          <p className="text-3xl font-semibold text-foreground">
            {lowStockCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Need replenishment or promotion attention.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/85 p-5">
          <p className="text-sm text-muted-foreground">Sold-out tiers</p>
          <p className="text-3xl font-semibold text-foreground">
            {soldOutCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Inventory completely depleted.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card/80 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <input
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Search event or tier"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all'
                  ? 'All inventory'
                  : option === 'low_stock'
                    ? 'Low stock'
                    : option === 'sold_out'
                      ? 'Sold out'
                      : 'Active'}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {filteredRows.length} result{filteredRows.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card/80 p-4 text-sm text-muted-foreground">
          Loading ticket health...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card/85">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3">Event</th>
                  <th className="px-3 py-3">Tier</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Remaining</th>
                  <th className="px-3 py-3">Sold</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-4 text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      No ticket tiers match this filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={`${row.eventId}-${row.tierName}`}
                      className="border-b border-border/60"
                    >
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {row.eventTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.eventStatus}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">{row.tierName}</td>
                      <td className="px-3 py-3">{formatKsh(row.price)}</td>
                      <td className="px-3 py-3">{row.remainingSlots}</td>
                      <td className="px-3 py-3">{row.soldSlots}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.stockHealth === 'sold_out'
                              ? 'bg-destructive/15 text-destructive'
                              : row.stockHealth === 'low_stock'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-success/15 text-success'
                          }`}
                        >
                          {row.stockHealth === 'sold_out'
                            ? 'Sold out'
                            : row.stockHealth === 'low_stock'
                              ? 'Low stock'
                              : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Page {Math.min(page, totalPages)} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <section className="rounded-xl border border-border bg-card/80 p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Event management
            </h2>
            <p className="text-sm text-muted-foreground">
              Review recent events, update their status, and remove stale
              entries.
            </p>
          </div>
          <input
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm md:max-w-xs"
            placeholder="Search events"
            value={eventQuery}
            onChange={(event) => setEventQuery(event.target.value)}
          />
        </div>

        {events.length === 0 ? (
          <div className="rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
            No events found.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event._id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.category} • {event.city} •{' '}
                    {new Date(event.startDateTime).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    value={event.status || 'pending'}
                    onChange={(target) =>
                      updateEventStatus(event._id, target.target.value)
                    }
                    disabled={savingEventId === event._id}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      updateEventStatus(event._id, event.status || 'pending')
                    }
                    disabled={savingEventId === event._id}
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    {savingEventId === event._id ? 'Saving...' : 'Update'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEvent(event._id)}
                    disabled={deletingEventId === event._id}
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60"
                  >
                    {deletingEventId === event._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {eventPagination.page} of {eventPagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setEventPage((current) => Math.max(1, current - 1))
              }
              disabled={eventPage <= 1}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setEventPage((current) =>
                  Math.min(eventPagination.totalPages || 1, current + 1)
                )
              }
              disabled={eventPage >= (eventPagination.totalPages || 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
