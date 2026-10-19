'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock3, Flame, Trophy, Users, Vote } from 'lucide-react';
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
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const formatCountdown = (dateValue, nowMs) => {
  if (!dateValue) return 'Date TBA';
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return 'Date TBA';
  const diff = target.getTime() - nowMs;

  if (diff <= 0) return 'Started';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return `${String(days).padStart(2, '0')} Days : ${String(hours).padStart(2, '0')} Hours : ${String(mins).padStart(2, '0')} Minutes : ${String(secs).padStart(2, '0')} Seconds`;
};

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const loadCompetitions = async () => {
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

    loadCompetitions();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const { activeCompetitions, pastCompetitions } = useMemo(() => {
    const ongoing = [];
    const upcoming = [];
    const past = [];

    for (const competition of competitions) {
      const { status, startDateTime, endDateTime } = getCompetitionStatus(
        competition,
        now
      );
      const withStatus = {
        competition,
        status,
        startDateTime,
        endDateTime,
        startTimeValue: getTimeValue(startDateTime),
        endTimeValue: getTimeValue(endDateTime),
      };

      if (status === 'ongoing') ongoing.push(withStatus);
      else if (status === 'past') past.push(withStatus);
      else upcoming.push(withStatus);
    }

    ongoing.sort((a, b) => a.startTimeValue - b.startTimeValue);
    upcoming.sort((a, b) => a.startTimeValue - b.startTimeValue);
    past.sort((a, b) => b.endTimeValue - a.endTimeValue);

    return {
      activeCompetitions: [...ongoing, ...upcoming],
      pastCompetitions: past,
    };
  }, [competitions, now]);

  const totals = useMemo(() => {
    const live = activeCompetitions.filter(
      (item) => item.status === 'ongoing'
    ).length;
    const contestants = activeCompetitions.reduce(
      (sum, item) => sum + Number(item.competition.contestantsCount || 0),
      0
    );
    return { live, contestants };
  }, [activeCompetitions]);

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Competitions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:w-72">
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Live</p>
              <p className="text-xl font-bold text-foreground">{totals.live}</p>
            </article>
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Contestants</p>
              <p className="text-xl font-bold text-foreground">
                {totals.contestants}
              </p>
            </article>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-border bg-card/75 p-4 md:p-5">
          <div className="flex items-center justify-end">
            <Link
              href="/competitions/past"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/60"
            >
              View Past Competitions
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading competitions...
          </div>
        ) : null}

        {!loading && activeCompetitions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No ongoing or upcoming competitions available right now. Check the
            past competitions section below.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activeCompetitions.map(
            ({ competition, status, startDateTime, endDateTime }) => {
              const startDate = startDateTime ? new Date(startDateTime) : null;
              const hasValidStart =
                !!startDate && !Number.isNaN(startDate.getTime());
              const endDate = endDateTime ? new Date(endDateTime) : null;
              const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());

              return (
                <article
                  key={competition._id}
                  className="overflow-hidden rounded-2xl border border-border bg-card/85 shadow-[0_12px_30px_-22px_rgba(59,130,246,.8)]"
                >
                  <div className="h-44 bg-[linear-gradient(145deg,rgba(30,64,175,.42),rgba(59,130,246,.08))] p-4">
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
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                        {competition.category}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                        <Flame className="mr-1 h-3 w-3" />
                        {status === 'ongoing' ? 'LIVE NOW' : 'UPCOMING'}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                      {competition.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {competition.description}
                    </p>

                    <p className="mt-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Clock3 className="mr-1 h-3.5 w-3.5" />
                      {status === 'ongoing'
                        ? 'Ongoing now'
                        : `Starts in: ${formatCountdown(startDateTime, now)}`}
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {hasValidStart
                          ? `${startDate.toLocaleDateString()} start`
                          : 'Start date TBA'}
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {hasValidEnd
                          ? `Ends: ${endDate.toLocaleDateString()}`
                          : 'End date TBA'}
                      </li>
                      <li className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {competition.contestantsCount || 0} contestants
                      </li>
                    </ul>

                    <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                      <p className="inline-flex items-center text-xs font-semibold text-success">
                        <Trophy className="mr-1 h-3.5 w-3.5" />
                        {status === 'ongoing'
                          ? 'Live standings'
                          : 'Upcoming competition'}
                      </p>
                      <Link
                        href={`/competitions/${competition._id}`}
                        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                      >
                        Open & Vote
                      </Link>
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card/70 p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                Past Competitions
              </h3>
              <p className="text-sm text-muted-foreground">
                Recently completed competitions are listed here.
              </p>
            </div>
            <Link
              href="/competitions/past"
              className="inline-flex items-center rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/70"
            >
              Open Full Archive
            </Link>
          </div>

          {pastCompetitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No past competitions yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pastCompetitions
                .slice(0, 6)
                .map(({ competition, startDateTime }) => {
                  const itemId = competition._id || competition.id;
                  const startDate = startDateTime
                    ? new Date(startDateTime)
                    : null;
                  const hasValidStart =
                    !!startDate && !Number.isNaN(startDate.getTime());

                  return (
                    <article
                      key={`past-${itemId}`}
                      className="overflow-hidden rounded-xl border border-border bg-background/60"
                    >
                      <div className="h-28 bg-[linear-gradient(145deg,rgba(30,64,175,.25),rgba(59,130,246,.06))] p-3">
                        <Image
                          className="h-full w-full rounded-md object-cover"
                          width={400}
                          height={220}
                          src={
                            competition?.bannerUrl ||
                            '/images/event-placeholder.png'
                          }
                          alt={competition.title}
                        />
                      </div>
                      <div className="p-4">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                          {competition.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {hasValidStart
                            ? startDate.toLocaleDateString()
                            : 'Date unavailable'}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {competition.category || 'Category unavailable'}
                        </p>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
