'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock3, RefreshCw, Users, Vote } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import Image from 'next/image';

const getCompetitionStatus = (competition, nowMs) => {
  const startDateTime = competition.startDateTime || competition.date;
  if (!startDateTime) {
    return { status: 'future', startDateTime: null, endDateTime: null };
  }

  const start = new Date(startDateTime);
  if (Number.isNaN(start.getTime())) {
    return { status: 'future', startDateTime: null, endDateTime: null };
  }

  const explicitEnd =
    competition.endDateTime ||
    (competition.endTime ? `${competition.date}T${competition.endTime}` : null);
  let end = explicitEnd ? new Date(explicitEnd) : null;

  if (!end || Number.isNaN(end.getTime()) || end < start) {
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  }

  const nowDate = new Date(nowMs);
  if (nowDate > end) {
    return { status: 'past', startDateTime: start, endDateTime: end };
  }
  if (nowDate >= start) {
    return { status: 'ongoing', startDateTime: start, endDateTime: end };
  }

  return { status: 'future', startDateTime: start, endDateTime: end };
};

const getTimeValue = (value) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

export default function PastCompetitionsPage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const fetchCompetitions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/events/competitions', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setCompetitions(data.competitions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const pastCompetitions = useMemo(() => {
    return competitions
      .map((competition) => {
        const statusData = getCompetitionStatus(competition, now);
        return {
          competition,
          ...statusData,
          endTimeValue: getTimeValue(statusData.endDateTime),
        };
      })
      .filter((item) => item.status === 'past')
      .sort((a, b) => b.endTimeValue - a.endTimeValue);
  }, [competitions, now]);

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Archive
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              Past Competitions
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Browse completed competitions and their voting history snapshots.
            </p>
          </div>

          <Link
            href="/competitions"
            className="inline-flex items-center rounded-lg border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/70"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Back to Live Competitions
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading past competitions...
          </div>
        ) : null}

        {!loading && pastCompetitions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No past competitions yet.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pastCompetitions.map(
            ({ competition, startDateTime, endDateTime }) => {
              const itemId = competition._id || competition.id;
              const startDate = startDateTime ? new Date(startDateTime) : null;
              const hasValidStart =
                !!startDate && !Number.isNaN(startDate.getTime());
              const endDate = endDateTime ? new Date(endDateTime) : null;
              const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());

              return (
                <article
                  key={itemId}
                  className="overflow-hidden rounded-2xl border border-border bg-card/85"
                >
                  <div className="h-44 bg-[linear-gradient(145deg,rgba(30,64,175,.25),rgba(59,130,246,.06))] p-4">
                    <Image
                      className="h-full w-full rounded-lg object-cover"
                      width={400}
                      height={260}
                      src={
                        competition?.bannerUrl ||
                        '/images/event-placeholder.png'
                      }
                      alt={competition.title}
                    />
                  </div>

                  <div className="p-5">
                    <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                      {competition.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {competition.description}
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {hasValidStart
                          ? `Started: ${startDate.toLocaleDateString()}`
                          : 'Start date unavailable'}
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {hasValidEnd
                          ? `Ended: ${endDate.toLocaleDateString()}`
                          : 'End date unavailable'}
                      </li>
                      <li className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {competition.contestantsCount || 0} contestants
                      </li>
                    </ul>

                    <div className="mt-5 border-t border-border/70 pt-4">
                      <Link
                        href={`/competitions/${competition._id}`}
                        className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/70"
                      >
                        Open Competition
                      </Link>
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      </section>
    </Layout>
  );
}
