'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Clock3,
  MapPin,
  Share2,
  Trophy,
  UserRound,
  Vote,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import { formatKsh } from '@/lib/currency';

const VOTE_COUNT_PRESETS = [1, 5, 10, 30];

function getCountdownText(dateValue, nowMs) {
  const now = new Date(nowMs);
  const target = new Date(dateValue);
  const diff = target.getTime() - now.getTime();

  if (Number.isNaN(target.getTime())) return 'Date not set';
  if (diff <= 0) return 'Competition ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return `${String(days).padStart(2, '0')} Days : ${String(hours).padStart(2, '0')} Hours : ${String(mins).padStart(2, '0')} Minutes : ${String(secs).padStart(2, '0')} Seconds`;
}

export default function CompetitionDetailPage() {
  const params = useParams();
  const competitionId = params?.id;

  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [requestedVotes, setRequestedVotes] = useState(1);
  const [dummyVoteMap, setDummyVoteMap] = useState({});
  const [now, setNow] = useState(() => Date.now());

  const loadCompetition = useCallback(async () => {
    if (!competitionId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/events/competitions/${competitionId}`,
        {
          cache: 'no-store',
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setMessage(data?.message || 'Unable to load competition');
        setCompetition(null);
        return;
      }

      setCompetition(data.competition || null);
      const availableCategories = data.competition?.categories || [];
      setSelectedCategory((previous) =>
        availableCategories.includes(previous)
          ? previous
          : availableCategories[0] || ''
      );
      const availablePackages = data.competition?.votePackages || [];
      if (availablePackages.length > 0) {
        setSelectedPackageId(
          (prev) => prev || String(availablePackages[0]._id)
        );
      }
      setMessage('');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!competitionId || competition?.voteDisplayMode !== 'real_plus_dummy') {
      setDummyVoteMap({});
      return;
    }

    const loadDummyVotes = async () => {
      try {
        const response = await fetch(
          `/api/public/dummy-votes?targetType=competition_event&targetId=${encodeURIComponent(competitionId)}`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        if (response.ok && data?.success) {
          setDummyVoteMap(data.adjustments || {});
        } else {
          setDummyVoteMap({});
        }
      } catch {
        setDummyVoteMap({});
      }
    };

    loadDummyVotes();
  }, [competitionId, competition?.voteDisplayMode]);

  const canVote = useMemo(() => {
    if (!competition) return false;
    const now = Date.now();
    const start = new Date(competition.startDateTime).getTime();
    const end = new Date(competition.endDateTime).getTime();
    return now >= start && now <= end;
  }, [competition]);

  const contestants = useMemo(() => {
    const list = competition?.contestants || [];
    const displayMode =
      competition?.voteDisplayMode === 'real_plus_dummy'
        ? 'real_plus_dummy'
        : 'real';
    return list
      .filter(
        (item) =>
          String(item?.category || '')
            .trim()
            .toLowerCase() === selectedCategory.trim().toLowerCase()
      )
      .map((item) => {
        const key = String(item?.key || '')
          .trim()
          .toLowerCase();
        const votes = Math.max(0, Number(item?.votes || 0));
        const dummyVotes = Math.max(0, Number(dummyVoteMap[key] || 0));
        return {
          ...item,
          votes: displayMode === 'real_plus_dummy' ? votes + dummyVotes : votes,
        };
      })
      .sort((a, b) => b.votes - a.votes);
  }, [competition, dummyVoteMap, selectedCategory]);

  const contestantTotalVotes = useMemo(
    () => contestants.reduce((sum, item) => sum + Number(item.votes || 0), 0),
    [contestants]
  );

  const shareContestantProfile = async (contestantKey) => {
    setProfileMessage('');
    const safeKey = encodeURIComponent(String(contestantKey || ''));
    const url = `${window.location.origin}/competitions/${competitionId}/contestants/${safeKey}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${competition?.title || 'Competition'} contestant profile`,
          text: 'Vote directly from this contestant profile link.',
          url,
        });
        setProfileMessage('Contestant profile link shared.');
        return;
      }

      await navigator.clipboard.writeText(url);
      setProfileMessage('Contestant profile link copied.');
    } catch {
      setProfileMessage('Could not share contestant profile link right now.');
    }
  };

  const votePackages = competition?.votePackages || [];

  const selectedPackage =
    votePackages.find((item) => String(item._id) === selectedPackageId) ||
    votePackages[0] ||
    null;
  const maxVotesPerTxn = Math.max(
    1,
    Math.round(Number(competition?.maxVotesPerTransaction || 1000))
  );
  const packageVoteSize = Math.max(1, Number(selectedPackage?.votes || 1));
  const packagePrice = Math.max(0, Number(selectedPackage?.price || 0));
  const perVoteCost = packagePrice / packageVoteSize;
  const desiredVotes = Math.min(
    maxVotesPerTxn,
    Math.max(1, Math.round(Number(requestedVotes || 1)))
  );
  const totalAmount = Math.round(perVoteCost * desiredVotes);

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading competition...
          </div>
        ) : null}

        {competition ? (
          <>
            <header className="mb-6 rounded-xl border border-border bg-card/80 p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                Competition Event
              </p>
              <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
                {competition.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {competition.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {/* Date */}
                <div className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Ends:</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {new Date(competition.endDateTime).toLocaleString()}
                  </span>
                </div>

                {/* Countdown - highlighted like WhatsApp */}
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-bold tabular-nums text-primary">
                    {getCountdownText(competition.endDateTime, now)}
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium">
                    {competition.venue}, {competition.city}
                  </span>
                </div>
              </div>
            </header>{' '}
            {message ? (
              <div className="mb-5 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-foreground">
                {message}
              </div>
            ) : null}
            {profileMessage ? (
              <div className="mb-5 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-foreground">
                {profileMessage}
              </div>
            ) : null}
            <section className="rounded-2xl border border-border bg-card/85 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <h2 className="inline-flex items-center text-xl font-semibold text-foreground">
                  <Trophy className="mr-2 h-5 w-5 text-primary" />
                  Contestants
                </h2>
                <div className="w-full space-y-1 sm:w-auto">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Vote package
                  </label>
                  <select
                    className="w-full rounded border border-input bg-background px-2 py-2 text-sm sm:w-64"
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                  >
                    {votePackages.map((pkg) => (
                      <option key={pkg._id} value={String(pkg._id)}>
                        {pkg.name} • {pkg.votes} vote{pkg.votes > 1 ? 's' : ''}{' '}
                        • {formatKsh(pkg.price)}
                      </option>
                    ))}
                    {votePackages.length === 0 ? (
                      <option value="">No vote packages configured</option>
                    ) : null}
                  </select>
                </div>
                <div className="w-full space-y-1 sm:w-auto">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Vote quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxVotesPerTxn}
                    value={desiredVotes}
                    onChange={(e) =>
                      setRequestedVotes(
                        Math.min(
                          maxVotesPerTxn,
                          Math.max(1, Math.round(Number(e.target.value || 1)))
                        )
                      )
                    }
                    className="w-full rounded border border-input bg-background px-2 py-2 text-sm sm:w-24"
                  />
                  <div className="flex flex-wrap gap-2">
                    {VOTE_COUNT_PRESETS.map((preset) => {
                      const isActive = desiredVotes === preset;
                      const disabled = preset > maxVotesPerTxn;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={disabled}
                          onClick={() => setRequestedVotes(preset)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:border-primary/50'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div
                className="mt-4 flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Competition categories"
              >
                {(competition.categories || []).map((category) => {
                  const categoryContestantCount = (
                    competition.contestants || []
                  ).filter(
                    (contestant) =>
                      String(contestant.category || '')
                        .trim()
                        .toLowerCase() === category.trim().toLowerCase()
                  ).length;
                  const active = selectedCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:border-primary/60'
                      }`}
                    >
                      {category}
                      <span className="ml-2 text-xs opacity-75">
                        {categoryContestantCount}
                      </span>
                    </button>
                  );
                })}
              </div>
              {contestants.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground">
                    {selectedCategory} • {contestants.length} contestant
                    {contestants.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-muted-foreground">
                    Leader: {contestants[0].fullName}
                    {competition.publicVoteDisplay === 'hide'
                      ? ' • votes hidden'
                      : ` • ${contestants[0].votes} votes`}
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                  No contestants have been added to this category yet.
                </p>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {contestants.map((contestant, index) => (
                  <article
                    key={contestant.key}
                    className="rounded-2xl border border-border bg-background/40 p-4"
                  >
                    <div className="mb-3 flex justify-center">
                      {contestant.profileImageUrl ? (
                        <img
                          src={contestant.profileImageUrl}
                          alt={contestant.fullName}
                          className="h-32 w-32 rounded-full border-[3px] border-primary object-cover"
                        />
                      ) : (
                        <div className="flex h-32 w-32 items-center justify-center rounded-full border-[3px] border-primary bg-background/60 text-muted-foreground">
                          <UserRound className="h-10 w-10" />
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary text-center">
                      {contestant.category}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      #{index + 1} {contestant.fullName}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {competition?.publicVoteDisplay === 'hide'
                        ? 'Votes hidden'
                        : competition?.publicVoteDisplay === 'percent'
                          ? `${(contestantTotalVotes > 0
                              ? (Number(contestant.votes || 0) /
                                  contestantTotalVotes) *
                                100
                              : 0
                            ).toFixed(2)}%`
                          : `${contestant.votes || 0} votes`}
                    </p>
                    {selectedPackage ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Package: {selectedPackage.name} • {desiredVotes} vote
                        {desiredVotes === 1 ? '' : 's'} at KSh{' '}
                        {Number(perVoteCost || 0).toFixed(2)} each for{' '}
                        {formatKsh(totalAmount)}
                      </p>
                    ) : null}

                    <div className="mt-4">
                      <div className="mb-2">
                        <button
                          type="button"
                          onClick={() => shareContestantProfile(contestant.key)}
                          className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          <Share2 className="mr-1 h-3.5 w-3.5" />
                          Share
                        </button>
                      </div>
                      {canVote && selectedPackage ? (
                        <MpesaCheckoutButton
                          eventId={competition._id}
                          eventTitle={competition.title}
                          amount={totalAmount}
                          paymentType="competition_vote"
                          contestantId={contestant.key}
                          packageId={String(selectedPackage._id)}
                          packageName={selectedPackage.name}
                          quantity={1}
                          requestedVotes={desiredVotes}
                          maxVoteQuantity={maxVotesPerTxn}
                          onPaymentSuccess={() => {
                            setMessage(
                              'Payment confirmed. Votes added successfully.'
                            );
                            loadCompetition();
                          }}
                          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex w-full items-center justify-center rounded-lg bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground"
                        >
                          {canVote ? 'Configure packages' : 'Voting closed'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!loading && !competition ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/80 p-6 text-sm text-muted-foreground">
            {message || 'Competition not found.'}
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
