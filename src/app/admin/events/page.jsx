'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Copy, MapPin, Search, UserRound } from 'lucide-react';
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

function CompetitionTicketLinks({ event, onSaved, onTicketEventChange }) {
  const [ticketEvents, setTicketEvents] = useState([]);
  const [ticketEventId, setTicketEventId] = useState(
    String(event.competition?.ticketEventId || '')
  );
  const [loadingTicketEvents, setLoadingTicketEvents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const loadTicketEvents = async () => {
      setLoadingTicketEvents(true);
      setMessage('');
      try {
        const response = await fetch(
          `/api/events/${event._id}/ticket-links`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || 'Unable to load ticketing events.');
        }
        if (active) {
          setTicketEvents(data.ticketEvents || []);
          setTicketEventId(String(data.ticketEventId || ''));
          onTicketEventChange(event._id, String(data.ticketEventId || ''));
        }
      } catch (loadError) {
        if (active) {
          setMessage(loadError.message || 'Unable to load ticketing events.');
        }
      } finally {
        if (active) setLoadingTicketEvents(false);
      }
    };
    loadTicketEvents();
    return () => {
      active = false;
    };
  }, [event._id, onTicketEventChange]);

  const saveTicketEvent = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/events/${event._id}/ticket-links`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketEventId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to save ticketing event.');
      }
      setTicketEventId(String(data.ticketEventId || ''));
      setMessage(data.message || 'Ticketing event saved.');
      await onSaved();
    } catch (saveError) {
      setMessage(saveError.message || 'Unable to save ticketing event.');
    } finally {
      setSaving(false);
    }
  };

  const getTicketLink = (contestant) => {
    if (!ticketEventId) return '';
    const referral = JSON.stringify({
      type: 'competition',
      eventId: String(event._id),
      fullName: contestant.fullName,
      category: contestant.category,
    });
    return `/events/${encodeURIComponent(ticketEventId)}?${new URLSearchParams(
      { ref: referral }
    ).toString()}`;
  };

  const copyTicketLink = async (contestant) => {
    const path = getTicketLink(contestant);
    if (!path) return;
    try {
      await navigator.clipboard.writeText(
        new URL(path, window.location.origin).toString()
      );
      setMessage(`Ticket link copied for ${contestant.fullName}.`);
    } catch {
      setMessage(`Unable to copy ticket link for ${contestant.fullName}.`);
    }
  };

  const contestants = event.competition?.contestants || [];

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-background/40 p-3">
      <h4 className="text-sm font-semibold text-foreground">
        Contestant ticket links
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose one approved ticketing event. Every contestant link will open
        this exact event.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          aria-label={`Ticketing event for ${event.title}`}
          className="min-w-56 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          value={ticketEventId}
          onChange={(changeEvent) => {
            const nextTicketEventId = changeEvent.target.value;
            setTicketEventId(nextTicketEventId);
            onTicketEventChange(event._id, nextTicketEventId);
          }}
          disabled={loadingTicketEvents || saving}
        >
          <option value="">Select an approved ticketing event</option>
          {ticketEvents.map((ticketEvent) => (
            <option key={ticketEvent._id} value={ticketEvent._id}>
              {ticketEvent.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={saveTicketEvent}
          disabled={
            saving ||
            loadingTicketEvents ||
            ticketEventId === String(event.competition?.ticketEventId || '')
          }
          className="rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save event'}
        </button>
      </div>
      {message ? (
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
      ) : null}
      {event.status === 'approved' && ticketEventId ? (
        <ul className="mt-3 space-y-2">
          {contestants.map((contestant) => {
            const link = getTicketLink(contestant);
            return (
              <li
                key={`${contestant.fullName}-${contestant.category}`}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-foreground">
                  {contestant.fullName}
                  <span className="ml-1 text-muted-foreground">
                    · {contestant.category}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    Ticket page
                  </a>
                  <button
                    type="button"
                    onClick={() => copyTicketLink(contestant)}
                    aria-label={`Copy ticket link for ${contestant.fullName}`}
                    title="Copy contestant ticket link"
                    className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [ticketEventSelections, setTicketEventSelections] = useState({});
  const [canEditTicketTiers, setCanEditTicketTiers] = useState(false);
  const [ticketTierError, setTicketTierError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [savingTicketTiers, setSavingTicketTiers] = useState(false);
  const [savingEventSchedule, setSavingEventSchedule] = useState(false);
  const [eventScheduleError, setEventScheduleError] = useState('');
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

  const handleTicketEventChange = useCallback((eventId, ticketEventId) => {
    setTicketEventSelections((previous) => ({
      ...previous,
      [eventId]: ticketEventId,
    }));
  }, []);

  const updateStatus = async (eventId, nextStatus, ticketEventId) => {
    const event = events.find((item) => String(item._id) === String(eventId));
    const selectedTicketEventId =
      ticketEventId ??
      ticketEventSelections[eventId] ??
      String(event?.competition?.ticketEventId || '');
    if (
      nextStatus === 'approved' &&
      event?.eventType === 'competition' &&
      !selectedTicketEventId
    ) {
      setError('Select a ticketing event before approving this competition.');
      return;
    }

    setSavingId(eventId);
    setError('');

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          ...(event?.eventType === 'competition' && selectedTicketEventId
            ? { ticketEventId: selectedTicketEventId }
            : {}),
        }),
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
    setTicketTierError('');
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiers: tiers.map((tier) => ({
            originalName: tier.originalName,
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
      setSelectedEvent((current) =>
        current
          ? { ...current, ...data.event, organizerId: current.organizerId }
          : data.event
      );
      setTicketTierError('');
      await load();
      return data.event;
    } catch (saveError) {
      setTicketTierError(saveError.message || 'Unable to update ticket tiers.');
      return null;
    } finally {
      setSavingTicketTiers(false);
    }
  };

  const saveEventSchedule = async (eventId, schedule) => {
    setSavingEventSchedule(true);
    setEventScheduleError('');
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDateTime: new Date(schedule.startDateTime).toISOString(),
          endDateTime: new Date(schedule.endDateTime).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to update event schedule.');
      }
      setSelectedEvent((current) =>
        current
          ? { ...current, ...data.event, organizerId: current.organizerId }
          : data.event
      );
      await load();
    } catch (saveError) {
      setEventScheduleError(
        saveError.message || 'Unable to update event schedule.'
      );
    } finally {
      setSavingEventSchedule(false);
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
                  View / Edit
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

              {event.eventType === 'competition' ? (
                <CompetitionTicketLinks
                  event={event}
                  onSaved={load}
                  onTicketEventChange={handleTicketEventChange}
                />
              ) : null}

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
        ticketTierError={ticketTierError}
        onSaveEventSchedule={saveEventSchedule}
        savingEventSchedule={savingEventSchedule}
        eventScheduleError={eventScheduleError}
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
