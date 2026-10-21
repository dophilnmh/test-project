'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import { formatKsh } from '@/lib/currency';

const valuePoints = [
  {
    title: 'Global-grade checkout',
    body: 'Fast ticket purchase flow with clear pricing and low-friction confirmation experience.',
    icon: Ticket,
  },
  {
    title: 'Verified organizers',
    body: 'Admin moderation and compliance checks keep attendees protected from unverified listings.',
    icon: ShieldCheck,
  },
  {
    title: 'Real-time discovery',
    body: 'Mobile-first browsing with featured experiences, categories, and event status indicators.',
    icon: Sparkles,
  },
];

function createParticle(index) {
  const seed = index + 1;
  const mix = (multiplier, offset = 0) => {
    const value = Math.sin(seed * multiplier + offset) * 10000;
    return value - Math.floor(value);
  };

  return {
    id: index,
    left: `${mix(12.9898) * 100}%`,
    top: `${mix(78.233, 0.5) * 100}%`,
    size: `${1 + mix(45.164) * 2.8}px`,
    opacity: (0.24 + mix(94.673) * 0.56).toFixed(2),
    duration: `${7 + mix(63.545) * 12}s`,
    delay: `${mix(24.357) * 5}s`,
    dx: `${(mix(11.783, 0.8) * 90 - 45).toFixed(0)}px`,
    dy: `${(mix(31.415, 0.3) * 90 - 45).toFixed(0)}px`,
  };
}

function CountdownSegments({ timing }) {
  const segments = [
    { label: 'Days', value: timing.days },
    { label: 'Hrs', value: timing.hours },
    { label: 'Min', value: timing.mins },
    { label: 'Sec', value: timing.secs },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {segments.map((segment, index) => (
        <div key={segment.label} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center rounded-md border border-primary/30 bg-slate-950/80 px-2 py-1 min-w-[2.4rem]">
            <span className="font-mono text-sm font-bold tabular-nums text-primary">
              {String(Math.max(0, segment.value)).padStart(2, '0')}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {segment.label}
            </span>
          </div>
          {index < segments.length - 1 ? (
            <span className="text-xs font-bold text-primary/60">:</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Helper function to parse dates consistently in UTC
const parseDateUTC = (dateString) => {
  if (!dateString) return NaN;

  try {
    // If the date is in format "16/07/2026 at 01:16:00"
    const match = dateString.match(
      /(\d{2})\/(\d{2})\/(\d{4}) at (\d{2}):(\d{2}):(\d{2})/
    );
    if (match) {
      const [_, day, month, year, hours, minutes, seconds] = match;
      // Create UTC date
      return Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      );
    }

    // If it's an ISO string or other format, parse and force UTC
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return NaN;

    // Return UTC timestamp
    return date.getTime();
  } catch {
    return NaN;
  }
};

// Skeleton Components
function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(30,210,201,0.18),transparent_35%),radial-gradient(circle_at_82%_6%,rgba(52,146,255,0.23),transparent_42%),linear-gradient(180deg,rgba(5,11,35,1)_0%,rgba(9,20,55,1)_100%)]" />
      <div className="relative z-10 container mx-auto px-4 py-20 md:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-1 h-8 w-32 animate-pulse" />
            <div className="h-16 w-3/4 bg-muted/20 rounded-lg animate-pulse mb-4" />
            <div className="h-16 w-2/3 bg-muted/20 rounded-lg animate-pulse mb-4" />
            <div className="h-6 w-full max-w-2xl bg-muted/20 rounded-lg animate-pulse mb-2" />
            <div className="h-6 w-3/4 max-w-2xl bg-muted/20 rounded-lg animate-pulse" />
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="h-12 w-40 bg-muted/20 rounded-lg animate-pulse" />
              <div className="h-12 w-40 bg-muted/20 rounded-lg animate-pulse" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/70 bg-card/85 p-5"
              >
                <div className="h-4 w-24 bg-muted/20 rounded animate-pulse mb-2" />
                <div className="h-8 w-20 bg-muted/20 rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-muted/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-border/80 bg-card/85 shadow-[0_12px_30px_-22px_rgba(59,130,246,.8)]">
      <div className="relative h-44 overflow-hidden bg-[linear-gradient(145deg,rgba(30,64,175,.42),rgba(59,130,246,.08))]">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/25 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-20 bg-muted/30 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-muted/30 rounded-full animate-pulse" />
          </div>
          <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>

      <div className="p-5">
        <div className="h-6 w-3/4 bg-muted/20 rounded animate-pulse mb-2" />
        <div className="h-4 w-full bg-muted/20 rounded animate-pulse mb-1" />
        <div className="h-4 w-2/3 bg-muted/20 rounded animate-pulse mb-3" />

        <div className="mt-3">
          <div className="h-4 w-24 bg-muted/20 rounded animate-pulse mb-2" />
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center rounded-md border border-primary/30 bg-slate-950/80 px-2 py-1 min-w-[2.4rem]">
                  <div className="h-4 w-6 bg-muted/30 rounded animate-pulse" />
                  <div className="h-2 w-4 bg-muted/30 rounded animate-pulse mt-1" />
                </div>
                {i < 4 && (
                  <span className="text-xs font-bold text-primary/60">:</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-4 w-40 bg-muted/20 rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted/20 rounded animate-pulse" />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <div className="h-5 w-20 bg-muted/20 rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted/20 rounded animate-pulse mt-1" />
          </div>
        </div>

        <div className="mt-4">
          <div className="h-11 w-full bg-muted/20 rounded-lg animate-pulse" />
        </div>
      </div>
    </article>
  );
}

function EventsGridSkeleton() {
  return (
    <section className="container mx-auto px-4 py-14 md:py-20">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
        <div className="h-5 w-32 bg-muted/20 rounded animate-pulse" />
      </div>

      <div className="grid gap-5">
        <EventCardSkeleton />
      </div>
    </section>
  );
}

function ValuePointsSkeleton() {
  return (
    <section className="container mx-auto px-4 pb-20">
      <div className="grid gap-4 rounded-2xl border border-border bg-secondary/40 p-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-card/85 p-5"
          >
            <div className="h-5 w-5 bg-muted/20 rounded animate-pulse" />
            <div className="h-6 w-3/4 bg-muted/20 rounded animate-pulse mt-3" />
            <div className="h-4 w-full bg-muted/20 rounded animate-pulse mt-2" />
            <div className="h-4 w-2/3 bg-muted/20 rounded animate-pulse mt-1" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="h-7 w-96 bg-muted/20 rounded animate-pulse" />
            <div className="h-4 w-80 bg-muted/20 rounded animate-pulse mt-1" />
          </div>
          <div className="h-11 w-48 bg-muted/20 rounded-lg animate-pulse" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-32 bg-muted/20 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PageSkeleton() {
  return (
    <Layout>
      <HeroSkeleton />
      <EventsGridSkeleton />
      <ValuePointsSkeleton />
    </Layout>
  );
}

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // All hooks must be called before any conditional returns
  const particles = useMemo(
    () => Array.from({ length: 200 }, (_, index) => createParticle(index)),
    []
  );

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/events?scope=landing', {
          cache: 'no-store',
        });
        const data = await response.json();
        if (response.ok && data?.success) {
          setEvents(data.events || []);

          // Debug logging - remove in production
          console.log('=== EVENTS DEBUG ===');
          data.events.forEach((event, index) => {
            console.log(`Event ${index + 1}:`, event.title);
            console.log('  Start (raw):', event.startDateTime);
            console.log('  End (raw):', event.endDateTime);
            const startUTC = parseDateUTC(event.startDateTime);
            const endUTC = parseDateUTC(event.endDateTime);
            console.log(
              '  Start (UTC):',
              startUTC ? new Date(startUTC).toISOString() : 'Invalid'
            );
            console.log(
              '  End (UTC):',
              endUTC ? new Date(endUTC).toISOString() : 'Invalid'
            );
            console.log('  ---');
          });
        }
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // All useMemo hooks must be called before the conditional return
  const totalContestants = useMemo(
    () =>
      events.reduce(
        (sum, event) => sum + (event.competition?.contestants || []).length,
        0
      ),
    [events]
  );

  const totalCategories = useMemo(
    () =>
      events.reduce((sum, event) => {
        const savedCategories = event.competition?.categories || [];
        if (savedCategories.length > 0) return sum + savedCategories.length;
        const legacyCategories = new Set(
          (event.competition?.contestants || [])
            .map((contestant) => String(contestant.category || '').trim())
            .filter(Boolean)
        );
        return sum + legacyCategories.size;
      }, 0),
    [events]
  );

  // FIXED: Proper date comparison with UTC
  const getEventTiming = (event) => {
    const start = parseDateUTC(event.startDateTime);
    const end = parseDateUTC(event.endDateTime);

    // Handle invalid dates
    if (isNaN(start) || isNaN(end)) {
      return { status: 'upcoming', countdown: 'Date to be confirmed' };
    }

    // Use UTC now for comparison
    const nowUTC = Date.now();

    // ENDED: Current time is after or at the end time
    if (nowUTC >= end) {
      return { status: 'ended', countdown: 'Event ended' };
    }

    // LIVE: Current time is between start and end (inclusive of start, exclusive of end)
    if (nowUTC >= start && nowUTC < end) {
      return { status: 'live', countdown: 'Live now' };
    }

    // UPCOMING: Current time is before the start time
    const target = new Date(start);
    const current = new Date(nowUTC);
    const diff = target.getTime() - current.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    return {
      status: 'upcoming',
      countdown: `${String(days).padStart(2, '0')} Days : ${String(hours).padStart(2, '0')} Hours : ${String(mins).padStart(2, '0')} Minutes : ${String(secs).padStart(2, '0')} Seconds`,
      days,
      hours,
      mins,
      secs,
    };
  };

  // Show skeleton while loading - this is now safe because all hooks are called above
  if (loading) {
    return <PageSkeleton />;
  }

  const sortedEvents = [...events].sort((left, right) => {
    const statusOrder = { live: 0, upcoming: 1, ended: 2 };
    const getTime = (value) => {
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    const leftStatus = getEventTiming(left).status;
    const rightStatus = getEventTiming(right).status;
    const statusDifference = statusOrder[leftStatus] - statusOrder[rightStatus];
    if (statusDifference !== 0) return statusDifference;

    if (leftStatus === 'ended') {
      return getTime(right.endDateTime) - getTime(left.endDateTime);
    }
    if (leftStatus === 'live') {
      return getTime(left.endDateTime) - getTime(right.endDateTime);
    }
    return getTime(left.startDateTime) - getTime(right.startDateTime);
  });

  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(30,210,201,0.18),transparent_35%),radial-gradient(circle_at_82%_6%,rgba(52,146,255,0.23),transparent_42%),linear-gradient(180deg,rgba(5,11,35,1)_0%,rgba(9,20,55,1)_100%)]" />
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          aria-hidden="true"
        >
          {particles.map((particle) => (
            <span
              key={particle.id}
              className="hero-particle"
              style={{
                left: particle.left,
                top: particle.top,
                '--particle-size': particle.size,
                '--particle-opacity': particle.opacity,
                '--particle-duration': particle.duration,
                '--particle-delay': particle.delay,
                '--particle-dx': particle.dx,
                '--particle-dy': particle.dy,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 container mx-auto px-4 py-20 md:py-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                NimblyPolls Platform
              </p>
              <h1 className="text-4xl font-bold leading-tight text-foreground md:text-6xl">
                Power Every Vote, Event, And Audience Moment
              </h1>
              <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
                A modern poll and ticketing ecosystem for voters, attendees,
                organizers, and operations teams. Discover trending campaigns,
                purchase quickly with M-Pesa or card, and join verified
                experiences.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/competitions"
                  className="inline-flex items-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Explore Competitions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/organizer/register"
                  className="inline-flex items-center rounded-lg border border-border bg-card/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/70"
                >
                  List Your Event
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <article className="rounded-2xl border border-border/70 bg-card/85 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Voting Events
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {events.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Competitions with public voting
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card/85 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Contestants
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {totalContestants.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Across featured competitions
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card/85 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Competition Categories
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {totalCategories.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Voting categories to explore
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Featured Competition
          </h2>
          <Link
            href="/competitions"
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all competitions
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sortedEvents.slice(0, 1).map((event) => {
            const eventId = event._id || event.id;
            const isCompetition =
              String(event.eventType || 'ticketing') === 'competition';
            const activeTier =
              (event.tiers || []).find(
                (tier) => Number(tier.remainingSlots || 0) > 0
              ) || (event.tiers || [])[0];
            const soldOut = (event.tiers || []).every(
              (tier) => Number(tier.remainingSlots || 0) <= 0
            );
            const heroBanner = String(event.bannerUrl || '').trim();
            const timing = getEventTiming(event);
            const eventIsLive = timing.status === 'live';
            const eventHasEnded = timing.status === 'ended';

            return (
              <article
                key={eventId}
                className="overflow-hidden rounded-2xl border border-border/80 bg-card/85 shadow-[0_12px_30px_-22px_rgba(59,130,246,.8)]"
              >
                <div className="relative h-44 overflow-hidden bg-[linear-gradient(145deg,rgba(30,64,175,.42),rgba(59,130,246,.08))]">
                  {heroBanner ? (
                    <Image
                      src={heroBanner}
                      alt={event.title || 'Event banner'}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/25 to-transparent" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                        {event.category || 'General'}
                      </span>
                      {!eventIsLive ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            eventHasEnded
                              ? 'bg-red-500/15 text-red-300'
                              : soldOut
                                ? 'bg-slate-500/15 text-slate-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                          }`}
                        >
                          <Flame className="mr-1 h-3 w-3" />
                          {eventHasEnded
                            ? 'ENDED'
                            : soldOut
                              ? 'SOLD OUT'
                              : 'UPCOMING'}
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium text-white/90">
                      {event.city || ''}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="line-clamp-2 text-lg font-semibold text-foreground">
                    {event.title || 'Untitled Event'}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {event.description || ''}
                  </p>

                  {eventIsLive ? (
                    <span
                      className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-white"
                      style={{
                        background:
                          'linear-gradient(90deg, #FF0000 0%, #E50914 100%)',
                      }}
                    >
                      <span
                        className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-white"
                        aria-hidden="true"
                      />
                      LIVE NOW
                    </span>
                  ) : null}

                  {timing.status === 'upcoming' ? (
                    <div className="mt-3">
                      <p className="mb-1.5 flex items-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Clock3 className="mr-1 h-3.5 w-3.5 text-primary" />
                        Countdown
                      </p>
                      <CountdownSegments timing={timing} />
                    </div>
                  ) : timing.status !== 'live' ? (
                    <p className="mt-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Clock3 className="mr-1 h-3.5 w-3.5" />
                      {timing.countdown}
                    </p>
                  ) : null}

                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {event.startDateTime
                        ? new Date(event.startDateTime).toLocaleDateString()
                        : 'TBD'}{' '}
                      at{' '}
                      {event.startDateTime
                        ? new Date(event.startDateTime).toLocaleTimeString()
                        : 'TBD'}
                    </li>
                    <li className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {event.venue || 'Location TBD'}
                    </li>
                  </ul>

                  <div className="mt-5 flex items-center justify-between">
                    {isCompetition ? (
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {eventHasEnded
                            ? 'Competition ended'
                            : eventIsLive
                              ? 'Public voting live'
                              : 'Voting opens at event start'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {eventHasEnded
                            ? 'Open the event to view final standings.'
                            : 'Open the event to view contestants and vote packages.'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {activeTier
                            ? formatKsh(activeTier.price)
                            : formatKsh(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeTier
                            ? Number(activeTier.remainingSlots || 0) <= 0
                              ? 'Sold out'
                              : `${activeTier.remainingSlots} slots left`
                            : 'No tier configured'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    {isCompetition ? (
                      <Link
                        href={`/competitions/${eventId}`}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                      >
                        View Competition
                      </Link>
                    ) : eventHasEnded ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-lg bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground cursor-not-allowed"
                      >
                        Event Ended
                      </button>
                    ) : eventIsLive ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-lg bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground cursor-not-allowed"
                      >
                        Event In Progress
                      </button>
                    ) : soldOut ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-lg bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground cursor-not-allowed"
                      >
                        Sold Out
                      </button>
                    ) : (
                      <MpesaCheckoutButton
                        eventId={eventId}
                        eventTitle={event.title || 'Event'}
                        amount={activeTier?.price || 0}
                        tierName={activeTier?.name || 'regular'}
                        quantity={1}
                        maxQuantity={Math.max(
                          1,
                          Number(activeTier?.remainingSlots || 1)
                        )}
                        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                      />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="grid gap-4 rounded-2xl border border-border bg-secondary/40 p-6 md:grid-cols-3">
          {valuePoints.map((point) => (
            <article
              key={point.title}
              className="rounded-xl border border-border/70 bg-card/85 p-5"
            >
              <point.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                {point.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {point.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                One account. Multiple roles. Global standards.
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Unified login, role-based access, and modern operations for
                attendees, organizers, and admin teams.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Continue to Login
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Verified listings
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <Clock3 className="h-3.5 w-3.5 text-primary" />
              Fast booking flow
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Secure operations
            </span>
          </div>
        </div>
      </section>
    </Layout>
  );
}
