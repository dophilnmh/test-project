'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, RefreshCw } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import Image from 'next/image';

const getEventStatus = (event, nowMs) => {
  const startDateTime = event.startDateTime || event.date;
  if (!startDateTime) return { status: 'future', startDateTime: null };

  const start = new Date(startDateTime);
  if (Number.isNaN(start.getTime())) {
    return { status: 'future', startDateTime: null };
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
  if (nowDate > end) return { status: 'past', startDateTime: start };
  if (nowDate >= start) return { status: 'ongoing', startDateTime: start };
  return { status: 'future', startDateTime: start };
};

const getEventEndTimeValue = (event) => {
  const startDateTime = event.startDateTime || event.date;
  const start = startDateTime ? new Date(startDateTime) : null;
  const explicitEnd =
    event.endDateTime ||
    (event.endTime ? `${event.date}T${event.endTime}` : null);
  let end = explicitEnd ? new Date(explicitEnd) : null;

  if (!end || Number.isNaN(end.getTime())) {
    if (!start || Number.isNaN(start.getTime())) return 0;
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  }

  return end.getTime();
};

export default function PastEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/events', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.success) {
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const pastEvents = useMemo(() => {
    return events
      .filter((event) => getEventStatus(event, now).status === 'past')
      .sort((a, b) => getEventEndTimeValue(b) - getEventEndTimeValue(a));
  }, [events, now]);

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Archive
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              Past Events
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Browse completed events and their details.
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center rounded-lg border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/70"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Back to Live Events
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading past events...
          </div>
        ) : null}

        {!loading && pastEvents.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No past events yet.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pastEvents.map((event) => {
            const eventId = event._id || event.id;
            const startDateTime = event.startDateTime || event.date;
            const startTimeText =
              event.startTime || new Date(startDateTime).toLocaleTimeString();

            return (
              <article
                key={eventId}
                className="overflow-hidden rounded-2xl border border-border bg-card/85"
              >
                <div className="h-44 bg-[linear-gradient(145deg,rgba(30,64,175,.25),rgba(59,130,246,.06))] p-4">
                  <Image
                    className="h-full w-full rounded-lg object-cover"
                    width={400}
                    height={400}
                    src={event?.bannerUrl || '/images/event-placeholder.png'}
                    alt={event.title}
                  />
                </div>

                <div className="p-5">
                  <p className="inline-flex rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-400">
                    ENDED
                  </p>
                  <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                    {event.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {event.description}
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {new Date(startDateTime).toLocaleDateString()} at{' '}
                      {startTimeText}
                    </li>
                    <li className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {event.venue}
                    </li>
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}
