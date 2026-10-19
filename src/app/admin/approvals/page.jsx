'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  UserRound,
  XCircle,
} from 'lucide-react';
import { EventDetailsModal } from '@/components/admin/EventDetailsModal';

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

export default function AdminApprovalsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [actionEventId, setActionEventId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [commissionDrafts, setCommissionDrafts] = useState({});

  const loadPending = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/events/pending', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to load pending events');
        return;
      }
      setEvents(data.events || []);
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const review = async (eventId, action) => {
    setFeedback('');
    setError('');
    setActionEventId(eventId);

    let rejectionReason = '';
    const draft = commissionDrafts[eventId] || {};
    if (action === 'reject') {
      rejectionReason = window.prompt('Enter rejection reason') || '';
      if (!rejectionReason.trim()) {
        setError('Rejection reason is required.');
        setActionEventId('');
        return;
      }
    }

    try {
      const response = await fetch(`/api/events/${eventId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason, ...draft }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Action failed');
        return;
      }

      setFeedback(data.message || `Event ${action}d`);
      setSelectedEvent(null);
      await loadPending();
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

  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card via-card to-background p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Event Governance
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
          Event Approvals
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review submitted events, validate organizer details, and approve for
          public listing.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Pending Reviews
          </p>
          <p className="mt-1 text-2xl font-semibold text-warning">
            {events.length}
          </p>
        </article>
      </section>

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

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
            Loading pending events...
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
            No pending events for approval.
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
                  Starts {formatDate(event.startDateTime)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="grid w-full gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-3">
                  {[
                    ['ticketCommissionPercent', 'Ticket'],
                    ['merchandiseCommissionPercent', 'Merchandise'],
                    ['votingCommissionPercent', 'Voting'],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="text-xs font-semibold text-foreground"
                    >
                      {label} Platform Commission (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={getCommissionDraft(event)[key]}
                        onChange={(e) =>
                          updateCommissionDraft(event, key, e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal"
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground hover:border-primary/50"
                >
                  View Full Event
                </button>
                <button
                  onClick={() => review(event._id, 'approve')}
                  disabled={actionEventId === event._id}
                  className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-success disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve & Go Live
                </button>
                <button
                  onClick={() => review(event._id, 'reject')}
                  disabled={actionEventId === event._id}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
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
        showActions
        actionEventId={actionEventId}
        onApprove={(id) => review(id, 'approve')}
        onReject={(id) => review(id, 'reject')}
        commissionTerms={
          selectedEvent ? getCommissionDraft(selectedEvent) : null
        }
        onCommissionChange={(key, value) =>
          selectedEvent && updateCommissionDraft(selectedEvent, key, value)
        }
      />
    </section>
  );
}
