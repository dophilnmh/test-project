'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, MapPin, Search, UserRound } from 'lucide-react';
import { EventDetailsModal } from '@/components/admin/EventDetailsModal';

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [canEditTicketTiers, setCanEditTicketTiers] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [savingTicketTiers, setSavingTicketTiers] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: PAGE_SIZE,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        scope: 'admin',
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (query.trim()) {
        params.set('q', query.trim());
      }

      const response = await fetch(`/api/events?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to load events');
        return;
      }

      setEvents(Array.isArray(data.events) ? data.events : []);
      setCanEditTicketTiers(Boolean(data.canEditTicketTiers));
      setPagination(
        data.pagination || {
          page: 1,
          totalPages: 1,
          total: 0,
          limit: PAGE_SIZE,
        }
      );
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const updateStatus = async (eventId, nextStatus) => {
    setSavingId(eventId);
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

      await load();
    } catch (updateError) {
      setError(updateError.message || 'Unable to update event');
    } finally {
      setSavingId('');
    }
  };

  const saveTicketTiers = async (eventId, tiers) => {
    setSavingTicketTiers(true);
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiers: tiers.map((tier) => ({
            name: tier.name,
            price: Number(tier.price),
            description: tier.description,
            isActive: tier.isActive,
            totalSlots: Number(tier.totalSlots),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to update ticket tiers.');
      }
      setSelectedEvent(data.event);
      await load();
    } catch (saveError) {
      setError(saveError.message || 'Unable to update ticket tiers.');
    } finally {
      setSavingTicketTiers(false);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event permanently?')) return;

    setDeletingId(eventId);
    setError('');

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to delete event');
      }

      await load();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete event');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card via-card to-background p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Event CRUD
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
          Events Management
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create, review, update, and remove event records from a single admin
          panel.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Total Events
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {pagination.total}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Visible Records
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {events.length}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card/85 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm"
            placeholder="Search title, venue, city, or organizer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
            No events found.
          </div>
        ) : (
          events.map((event) => (
            <article
              key={event._id}
              className="rounded-xl border border-border bg-card/90 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {event.category || 'General'}
                  </p>
                </div>
                <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-warning">
                  {event.status || 'pending'}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  {event.organizerId?.organizationName ||
                    event.organizerName ||
                    '-'}
                </p>
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {event.venue} • {event.city}
                </p>
                <p className="inline-flex items-center gap-2 md:col-span-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Submitted {formatDate(event.createdAt)} • Starts{' '}
                  {formatDate(event.startDateTime)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground hover:border-primary/50"
                >
                  View
                </button>

                <select
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  value={event.status || 'pending'}
                  onChange={(eventTarget) =>
                    updateStatus(event._id, eventTarget.target.value)
                  }
                  disabled={savingId === event._id}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    updateStatus(event._id, event.status || 'pending')
                  }
                  disabled={savingId === event._id}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                >
                  {savingId === event._id ? 'Saving...' : 'Update'}
                </button>

                <button
                  type="button"
                  onClick={() => deleteEvent(event._id)}
                  disabled={deletingId === event._id}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60"
                >
                  {deletingId === event._id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <EventDetailsModal
        key={selectedEvent?._id || 'event-details'}
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        canEditTicketTiers={canEditTicketTiers}
        onSaveTicketTiers={saveTicketTiers}
        savingTicketTiers={savingTicketTiers}
      />

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
