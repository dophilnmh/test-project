'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Clock3, Loader2, Share2, UserRound } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

function getCountdownText(dateValue, nowMs) {
  const now = new Date(nowMs);
  const target = new Date(dateValue);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return 'Campaign ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return `${String(days).padStart(2, '0')} Days : ${String(hours).padStart(2, '0')} Hours : ${String(mins).padStart(2, '0')} Minutes : ${String(secs).padStart(2, '0')} Seconds`;
}

function getDeviceId() {
  const storageKey = 'nimblypoll_device_id';
  let deviceId = window.localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId =
      window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

export default function VotingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.id;

  const [campaign, setCampaign] = useState(null);
  const [results, setResults] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedContestantId, setSelectedContestantId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dummyVoteMap, setDummyVoteMap] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteToast, setVoteToast] = useState('');

  const castFreeVote = async () => {
    if (!selectedContestant || submittingVote || hasVoted) return;
    setSubmittingVote(true);
    setMessage('');
    try {
      const response = await fetch(`/api/voting/campaigns/${campaignId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-voter-device-id': getDeviceId(),
        },
        body: JSON.stringify({ nomineeId: String(selectedContestant._id) }),
      });
      const data = await response.json();
      setMessage(data.message || 'Unable to cast vote');
      if (response.ok && data?.success) {
        const selectedId = String(selectedContestant._id);
        setHasVoted(true);
        setVoteToast('Your vote was cast successfully.');
        setResults((previousResults) => {
          const alreadyIncluded = previousResults.some(
            (result) => String(result._id) === selectedId
          );

          if (!alreadyIncluded) {
            return [...previousResults, { _id: selectedId, voteCount: 1 }];
          }

          return previousResults.map((result) =>
            String(result._id) === selectedId
              ? { ...result, voteCount: Number(result.voteCount || 0) + 1 }
              : result
          );
        });
        window.setTimeout(() => setVoteToast(''), 3500);
        await loadCampaign();
      }
    } finally {
      setSubmittingVote(false);
    }
  };

  const loadCampaign = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const eventResponse = await fetch(
        `/api/events/competitions/${encodeURIComponent(String(campaignId))}`,
        { cache: 'no-store' }
      );
      if (eventResponse.ok) {
        router.replace(
          `/competitions/${encodeURIComponent(String(campaignId))}`
        );
        return;
      }

      const [campaignResponse, resultsResponse] = await Promise.all([
        fetch(`/api/voting/campaigns/${campaignId}`, {
          cache: 'no-store',
          headers: { 'x-voter-device-id': getDeviceId() },
        }),
        fetch(`/api/voting/campaigns/${campaignId}/results`, {
          cache: 'no-store',
        }),
      ]);

      const campaignData = await campaignResponse.json();
      const resultData = await resultsResponse.json();

      if (campaignResponse.ok && campaignData?.success) {
        setCampaign(campaignData.campaign || null);
        setHasVoted(Boolean(campaignData.hasVoted));

        const contestants =
          campaignData.campaign?.contestants ||
          campaignData.campaign?.nominees ||
          [];
        setSelectedContestantId(
          (prev) => prev || String(contestants[0]?._id || '')
        );
      }

      if (resultsResponse.ok && resultData?.success) {
        setResults(resultData.results || []);
      } else {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  useEffect(() => {
    if (
      !campaignId ||
      campaign?.status !== 'live' ||
      campaign?.resultVisibility !== 'live'
    ) {
      return undefined;
    }

    const refreshResults = async () => {
      try {
        const response = await fetch(
          `/api/voting/campaigns/${campaignId}/results`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        if (response.ok && data?.success) {
          setResults(data.results || []);
        }
      } catch {
        // Keep the latest results visible if a refresh briefly fails.
      }
    };

    const timer = setInterval(refreshResults, 5000);
    return () => clearInterval(timer);
  }, [campaignId, campaign?.resultVisibility, campaign?.status]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!campaignId || campaign?.voteDisplayMode !== 'real_plus_dummy') {
      setDummyVoteMap({});
      return;
    }

    const loadDummyVotes = async () => {
      try {
        const response = await fetch(
          `/api/public/dummy-votes?targetType=campaign_vote&targetId=${encodeURIComponent(campaignId)}`,
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
  }, [campaignId, campaign?.voteDisplayMode]);

  const canVote = useMemo(() => {
    if (!campaign) return false;
    const now = new Date();
    const starts = new Date(campaign.startDateTime);
    const ends = new Date(campaign.endDateTime);
    return campaign.status === 'live' && now >= starts && now <= ends;
  }, [campaign]);
  const showPublicResults =
    campaign?.resultVisibility === 'live' ||
    campaign?.status === 'ended' ||
    (campaign?.endDateTime && now >= new Date(campaign.endDateTime).getTime());
  const publicVoteDisplay = ['count', 'percent', 'hide'].includes(
    campaign?.publicVoteDisplay
  )
    ? campaign.publicVoteDisplay
    : 'count';
  const showVoteFigures = showPublicResults && publicVoteDisplay !== 'hide';

  const contestants = useMemo(
    () => campaign?.contestants || campaign?.nominees || [],
    [campaign]
  );
  const contestantRows = useMemo(() => {
    const displayMode =
      campaign?.voteDisplayMode === 'real_plus_dummy'
        ? 'real_plus_dummy'
        : 'real';
    return contestants
      .map((contestant) => {
        const contestantId = String(contestant?._id || '');
        const result = results.find(
          (item) => String(item._id) === contestantId
        );
        const realVotes = Math.max(
          0,
          Number(result?.voteCount ?? contestant?.voteCount ?? 0)
        );
        const dummyVotes = Math.max(0, Number(dummyVoteMap[contestantId] || 0));
        return {
          ...contestant,
          category:
            String(contestant?.category || 'General').trim() || 'General',
          votes:
            displayMode === 'real_plus_dummy'
              ? realVotes + dummyVotes
              : realVotes,
        };
      })
      .sort((a, b) => b.votes - a.votes);
  }, [campaign?.voteDisplayMode, contestants, dummyVoteMap, results]);

  const categories = useMemo(
    () =>
      Array.from(new Set(contestantRows.map((item) => item.category))).sort(),
    [contestantRows]
  );

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0] || 'General');
    }
  }, [categories, selectedCategory]);

  const categoryContestants = useMemo(
    () => contestantRows.filter((item) => item.category === selectedCategory),
    [contestantRows, selectedCategory]
  );

  const contestantTotalVotes = useMemo(
    () => categoryContestants.reduce((sum, item) => sum + item.votes, 0),
    [categoryContestants]
  );

  useEffect(() => {
    if (
      !categoryContestants.some(
        (item) => String(item._id) === selectedContestantId
      )
    ) {
      setSelectedContestantId(String(categoryContestants[0]?._id || ''));
    }
  }, [categoryContestants, selectedContestantId]);

  const selectedContestant = categoryContestants.find(
    (item) => String(item._id) === selectedContestantId
  );

  const shareContestant = async (contestant) => {
    const url = `${window.location.origin}/voting/${campaignId}/contestants/${contestant._id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${contestant.name} on ${campaign?.title || 'NimblyPolls'}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage('Contestant link copied.');
      }
    } catch {
      setMessage('Could not share contestant link.');
    }
  };

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        {voteToast ? (
          <div
            role="status"
            className="fixed right-4 top-4 z-50 rounded-xl border border-emerald-400/40 bg-emerald-950/95 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-lg"
          >
            {voteToast}
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading voting campaign...
          </div>
        ) : null}

        {campaign ? (
          <>
            <header className="mb-8 overflow-hidden rounded-2xl border border-border bg-card/80">
              {campaign.bannerUrl ? (
                <div className="relative h-48 w-full md:h-64">
                  <Image
                    src={campaign.bannerUrl}
                    alt={`${campaign.title} banner`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                  />
                </div>
              ) : null}
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {campaign.category}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
                  {campaign.title}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">
                  {campaign.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center rounded-full border border-border px-3 py-1">
                    <Clock3 className="mr-1 h-4 w-4 text-primary" />
                    {getCountdownText(campaign.endDateTime, now)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border px-3 py-1">
                    Status: {campaign.status}
                  </span>
                </div>
              </div>
            </header>

            {message ? (
              <div className="mb-5 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-foreground">
                {message}
              </div>
            ) : null}
            <section className="rounded-xl border border-border bg-card/85 p-4 sm:p-5">
              <div
                className="mb-4 flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Poll categories"
              >
                {categories.map((category) => {
                  const active = category === selectedCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 rounded-md border px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:border-primary/60'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              {message ? (
                <div className="mb-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground">
                  {message}
                </div>
              ) : null}
              {hasVoted ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  Your vote for this poll has been recorded.
                </p>
              ) : null}

              <div className="space-y-2">
                {categoryContestants.map((contestant) => {
                  const percent =
                    contestantTotalVotes > 0
                      ? (contestant.votes / contestantTotalVotes) * 100
                      : 0;
                  const voteFigure =
                    publicVoteDisplay === 'percent'
                      ? `${percent.toFixed(1)}%`
                      : `${contestant.votes} vote${contestant.votes === 1 ? '' : 's'}`;
                  const selected =
                    String(contestant._id) === selectedContestantId;

                  return (
                    <div
                      key={contestant._id}
                      className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedContestantId(String(contestant._id))
                        }
                        aria-pressed={selected}
                        className={`grid w-full grid-cols-[40px_minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 rounded-lg border p-2 text-left transition sm:grid-cols-[56px_minmax(140px,220px)_minmax(0,1fr)] sm:gap-4 sm:p-3 ${
                          selected
                            ? 'border-primary/70 bg-primary/5'
                            : 'border-border/70 bg-background/40 hover:border-primary/40'
                        }`}
                      >
                        {contestant.imageUrl ? (
                          <Image
                            src={contestant.imageUrl}
                            alt=""
                            width={56}
                            height={56}
                            className="h-10 w-10 rounded-md object-cover sm:h-14 sm:w-14"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground sm:h-14 sm:w-14">
                            <UserRound className="h-5 w-5" />
                          </span>
                        )}
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">
                          {contestant.name}
                        </span>
                        <span className="min-w-0">
                          {showVoteFigures ? (
                            <span className="mb-1 block text-right text-xs font-semibold text-foreground sm:text-sm">
                              {voteFigure}
                            </span>
                          ) : null}
                          <span
                            className={`block h-3 min-w-0 overflow-hidden rounded-full bg-muted ${
                              showVoteFigures ? '' : 'invisible'
                            }`}
                            role="progressbar"
                            aria-label={`${contestant.name} vote share`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Number(percent.toFixed(1))}
                          >
                            <span
                              className="block h-full rounded-full bg-primary transition-[width] duration-500"
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => shareContestant(contestant)}
                        aria-label={`Share ${contestant.name}'s voting link`}
                        title={`Share ${contestant.name}'s voting link`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                {categoryContestants.length === 0 ? (
                  <p className="rounded-lg border border-border/70 bg-background/40 px-3 py-5 text-sm text-muted-foreground">
                    No contestants in this category yet.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Selected:{' '}
                  <span className="font-semibold text-foreground">
                    {selectedContestant?.name || 'Choose a contestant'}
                  </span>
                </p>
                {canVote ? (
                  <button
                    type="button"
                    onClick={castFreeVote}
                    disabled={!selectedContestant || hasVoted || submittingVote}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {submittingVote ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recording vote...
                      </>
                    ) : hasVoted ? (
                      'Vote recorded'
                    ) : (
                      'Cast Vote'
                    )}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    Voting closed
                  </span>
                )}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </Layout>
  );
}
