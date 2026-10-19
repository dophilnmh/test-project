'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { formatKsh } from '@/lib/currency';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import Image from 'next/image';

const formatTicketName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getEventStatus = (event, nowMs) => {
  const startDateTime = event.startDateTime || event.date;
  if (!startDateTime) {
    return { status: 'future', startDateTime: null, endDateTime: null };
  }

  const start = new Date(startDateTime);
  if (Number.isNaN(start.getTime())) {
    return { status: 'future', startDateTime: null, endDateTime: null };
  }

  const explicitEnd =
    event.endDateTime ||
    (event.endTime ? `${event.date}T${event.endTime}` : null);
  let end = explicitEnd ? new Date(explicitEnd) : null;

  if (!end || Number.isNaN(end.getTime()) || end < start) {
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  }

  const nowDate = new Date(nowMs);
  if (nowDate > end)
    return { status: 'past', startDateTime: start, endDateTime: end };
  if (nowDate >= start) {
    return { status: 'ongoing', startDateTime: start, endDateTime: end };
  }

  return { status: 'future', startDateTime: start, endDateTime: end };
};

const getTimeValue = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

function PublicEventsPageInner() {
  const searchParams = useSearchParams();
  const targetEventRef = useRef(null);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ticketQuantitySelection, setTicketQuantitySelection] = useState({});

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/events', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.success) {
        setEvents(data.events || []);

        setTicketQuantitySelection({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    const targetEventId = String(searchParams.get('eventId') || '').trim();
    if (!targetEventId) return;

    const timeout = setTimeout(() => {
      const element = document.getElementById(`event-${targetEventId}`);
      if (element) {
        targetEventRef.current = element;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.style.outline = '2px solid rgba(59,130,246,0.9)';
        element.style.outlineOffset = '8px';
        element.style.borderRadius = '1rem';
        setTimeout(() => {
          if (element) {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.style.borderRadius = '';
          }
        }, 2500);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [searchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getCountdownText = (dateValue, elapsedLabel = 'Ended') => {
    if (!dateValue) return 'Date TBA';
    const currentTime = new Date(now);
    const target = new Date(dateValue);
    if (Number.isNaN(target.getTime())) return 'Date TBA';
    const diff = target.getTime() - currentTime.getTime();

    if (diff <= 0) return elapsedLabel;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    return `${days}d ${hours}h ${mins}m ${secs}s`;
  };

  const { activeEvents, pastEvents } = useMemo(() => {
    const ongoing = [];
    const upcoming = [];
    const past = [];

    for (const event of events) {
      const { status, startDateTime, endDateTime } = getEventStatus(event, now);
      const eventWithStatus = {
        event,
        status,
        startDateTime,
        endDateTime,
        startTimeValue: getTimeValue(startDateTime),
        endTimeValue: getTimeValue(endDateTime),
      };

      if (status === 'ongoing') ongoing.push(eventWithStatus);
      else if (status === 'past') past.push(eventWithStatus);
      else upcoming.push(eventWithStatus);
    }

    ongoing.sort((a, b) => a.startTimeValue - b.startTimeValue);
    upcoming.sort((a, b) => a.startTimeValue - b.startTimeValue);
    past.sort((a, b) => b.endTimeValue - a.endTimeValue);

    return { activeEvents: [...ongoing, ...upcoming], pastEvents: past };
  }, [events, now]);

  const totalSeats = useMemo(
    () =>
      activeEvents.reduce(
        (sum, event) =>
          sum +
          (event.event.tiers || []).reduce(
            (tierSum, tier) => tierSum + Number(tier.remainingSlots || 0),
            0
          ),
        0
      ),
    [activeEvents]
  );

  const categoryOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        (events || [])
          .map((event) => String(event?.category || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ['All', ...unique];
  }, [events]);

  useEffect(() => {
    if (!categoryOptions.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categoryOptions, selectedCategory]);

  const matchesCategory = useCallback(
    (event) => {
      if (selectedCategory === 'All') return true;
      return (
        String(event?.category || '')
          .trim()
          .toLowerCase() === selectedCategory.toLowerCase()
      );
    },
    [selectedCategory]
  );

  const matchesSearch = useCallback(
    (event) => {
      const needle = String(searchQuery || '')
        .trim()
        .toLowerCase();
      if (!needle) return true;
      const haystack = [
        event?.title,
        event?.city,
        event?.organizer,
        event?.venue,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    },
    [searchQuery]
  );

  const filteredActiveEvents = useMemo(() => {
    return activeEvents.filter(({ event, status }) => {
      if (!matchesCategory(event) || !matchesSearch(event)) return false;
      if (statusFilter === 'all') return true;
      return status === statusFilter;
    });
  }, [activeEvents, matchesCategory, matchesSearch, statusFilter]);

  const filteredPastEvents = useMemo(() => {
    return pastEvents.filter(({ event }) => {
      return matchesCategory(event) && matchesSearch(event);
    });
  }, [pastEvents, matchesCategory, matchesSearch]);

  const showPastSection = statusFilter === 'all' || statusFilter === 'past';

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        {searchParams.get('ticketPayment') === 'success' ? (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-400/50 bg-emerald-950/40 p-4 text-sm text-emerald-100"
          >
            Card payment successful. Your ticket is confirmed
            {searchParams.get('ticketCode')
              ? `: ${searchParams.get('ticketCode')}`
              : '.'}
          </div>
        ) : searchParams.get('ticketPayment') === 'failed' ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-400/50 bg-rose-950/40 p-4 text-sm text-rose-100"
          >
            {searchParams.get('message') || 'Card payment was not completed.'}
          </div>
        ) : null}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Discover
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              Available Events & Tickets
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Explore approved events with verified organizers, transparent
              ticket pricing, and real-time inventory.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:w-[320px]">
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Active Events</p>
              <p className="text-xl font-bold text-foreground">
                {filteredActiveEvents.length}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Seats Left</p>
              <p className="text-xl font-bold text-foreground">
                {totalSeats.toLocaleString()}
              </p>
            </article>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-border bg-card/75 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex grow items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4 text-primary" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search event name, city, or organizer"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <div className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              <SlidersHorizontal className="h-4 w-4" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-transparent text-sm font-semibold text-primary outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="ongoing">Live Now</option>
                <option value="future">Upcoming</option>
                <option value="past">Past Events</option>
              </select>
            </div>
            <Link
              href="/events/past"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/60"
            >
              View Past Events
            </Link>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === category
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background/80 text-foreground/90 hover:border-primary/70'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading approved events...
          </div>
        ) : null}

        {!loading &&
        statusFilter !== 'past' &&
        filteredActiveEvents.length === 0 ? (
          <div className="mb-6 rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No events match your current search or filter.
          </div>
        ) : null}

        {statusFilter !== 'past' ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredActiveEvents.map(
              ({ event, status, startDateTime, endDateTime }) => {
                const eventId = event._id || event.id;
                const soldOut = (event.tiers || []).every(
                  (tier) => Number(tier.remainingSlots || 0) <= 0
                );

                const startDate = startDateTime
                  ? new Date(startDateTime)
                  : null;
                const hasValidStart =
                  !!startDate && !Number.isNaN(startDate.getTime());
                const startTimeText =
                  event.startTime ||
                  (hasValidStart ? startDate.toLocaleTimeString() : 'Time TBA');

                return (
                  <article
                    id={`event-${eventId}`}
                    key={eventId}
                    className="overflow-hidden rounded-2xl border border-border bg-card/85 shadow-[0_12px_30px_-22px_rgba(59,130,246,.8)]"
                  >
                    <div className="h-44 bg-[linear-gradient(145deg,rgba(30,64,175,.42),rgba(59,130,246,.08))] p-4">
                      <Image
                        className="h-full w-full rounded-lg object-cover"
                        width={400}
                        height={400}
                        src={
                          event?.bannerUrl || '/images/event-placeholder.png'
                        }
                        alt={event.title}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                          {event.category}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                          <Flame className="mr-1 h-3 w-3" />
                          {event.badge ||
                            (soldOut
                              ? 'SOLD OUT'
                              : status === 'ongoing'
                                ? 'LIVE NOW'
                                : 'UPCOMING')}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                        {event.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {event.description}
                      </p>

                      <p className="mt-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <Clock3 className="mr-1 h-3.5 w-3.5" />
                        {status === 'ongoing'
                          ? `Ends in: ${getCountdownText(endDateTime, 'Ended')}`
                          : `Starts in: ${getCountdownText(startDateTime, 'Started')}`}
                      </p>

                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          {hasValidStart
                            ? `${startDate.toLocaleDateString()} at ${startTimeText}`
                            : 'Date and time TBA'}
                        </li>
                        <li className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {event.venue}
                        </li>
                        {/* <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {(event.attendees || 0).toLocaleString()} interested
                      attendees
                    </li> */}
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          Verified organizer: {event.organizer}
                        </li>
                      </ul>

                      <div className="mt-5 space-y-3">
                        {(event.tiers || []).map((tier) => {
                          const isTierSoldOut =
                            Number(tier.remainingSlots || 0) <= 0;
                          const maxQuantity = Math.max(
                            1,
                            Number(tier.remainingSlots || 0)
                          );
                          const quantityKey = `${eventId}:${tier.name}`;
                          const quantity = Math.min(
                            maxQuantity,
                            Math.max(
                              1,
                              Number(ticketQuantitySelection[quantityKey] || 1)
                            )
                          );
                          const ticketName = formatTicketName(tier.name);

                          return (
                            <div
                              key={quantityKey}
                              className={`rounded-lg border p-3 shadow-[0_0_14px_rgba(44,229,216,0.18)] ${
                                isTierSoldOut
                                  ? 'border-neutral-500 bg-neutral-800 text-neutral-300 shadow-none'
                                  : 'border-[#2CE5D8] bg-[#0A0E27] text-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold">
                                    {ticketName}
                                  </h3>
                                  <p className="mt-1 line-clamp-2 text-xs opacity-75">
                                    {tier.description || event.description}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-bold">
                                  {formatKsh(tier.price)}
                                </p>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="inline-flex items-center rounded-md border border-current/30">
                                  <button
                                    type="button"
                                    aria-label={`Decrease ${ticketName} quantity`}
                                    disabled={isTierSoldOut || quantity <= 1}
                                    onClick={() =>
                                      setTicketQuantitySelection((prev) => ({
                                        ...prev,
                                        [quantityKey]: quantity - 1,
                                      }))
                                    }
                                    className="px-3 py-1.5 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    -
                                  </button>
                                  <span
                                    aria-live="polite"
                                    className="min-w-8 text-center text-sm font-semibold"
                                  >
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Increase ${ticketName} quantity`}
                                    disabled={
                                      isTierSoldOut || quantity >= maxQuantity
                                    }
                                    onClick={() =>
                                      setTicketQuantitySelection((prev) => ({
                                        ...prev,
                                        [quantityKey]: quantity + 1,
                                      }))
                                    }
                                    className="px-3 py-1.5 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    +
                                  </button>
                                </div>

                                {isTierSoldOut ? (
                                  <span className="text-xs font-bold tracking-wide">
                                    SOLD OUT
                                  </span>
                                ) : (
                                  <MpesaCheckoutButton
                                    eventId={eventId}
                                    eventTitle={event.title}
                                    amount={tier.price}
                                    tierName={tier.name}
                                    quantity={quantity}
                                    maxQuantity={tier.remainingSlots}
                                    buttonLabel="Purchase"
                                    className="inline-flex items-center rounded-md bg-[#2CE5D8] px-3 py-2 text-sm font-bold text-[#0A0E27] transition hover:bg-[#9af5ee]"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        ) : null}

        {showPastSection ? (
          <div className="mt-10 rounded-2xl border border-border bg-card/70 p-5 md:p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Past Events
                </h3>
                <p className="text-sm text-muted-foreground">
                  Recently completed events are listed here.
                </p>
              </div>
              <Link
                href="/events/past"
                className="inline-flex items-center rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/70"
              >
                Open Full Archive
              </Link>
            </div>

            {filteredPastEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No past events match your current search or filter.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPastEvents
                  .slice(0, 6)
                  .map(({ event, startDateTime }) => {
                    const eventId = event._id || event.id;
                    const startDate = startDateTime
                      ? new Date(startDateTime)
                      : null;
                    const hasValidStart =
                      !!startDate && !Number.isNaN(startDate.getTime());

                    return (
                      <article
                        key={`past-${eventId}`}
                        className="overflow-hidden rounded-xl border border-border bg-background/60"
                      >
                        <div className="h-28 bg-[linear-gradient(145deg,rgba(30,64,175,.25),rgba(59,130,246,.06))] p-3">
                          <Image
                            className="h-full w-full rounded-md object-cover"
                            width={400}
                            height={220}
                            src={
                              event?.bannerUrl ||
                              '/images/event-placeholder.png'
                            }
                            alt={event.title}
                          />
                        </div>
                        <div className="p-4">
                          <p className="inline-flex rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-400">
                            ENDED
                          </p>
                          <p className="text-sm font-semibold text-foreground line-clamp-2">
                            {event.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {hasValidStart
                              ? startDate.toLocaleDateString()
                              : 'Date unavailable'}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {event.venue || 'Venue unavailable'}
                          </p>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-10 rounded-2xl border border-border bg-card/70 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                Need to host your own event?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Launch your event, manage capacity, and publish listings after
                verification.
              </p>
            </div>
            <Link
              href="/organizer/register"
              className="inline-flex items-center rounded-lg border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/70"
            >
              Create Organizer Account
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default function PublicEventsPage() {
  return (
    <Suspense fallback={null}>
      <PublicEventsPageInner />
    </Suspense>
  );
}
