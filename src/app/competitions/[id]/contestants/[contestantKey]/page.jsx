'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Share2, UserRound, Vote } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import { formatKsh } from '@/lib/currency';

const VOTE_COUNT_PRESETS = [1, 5, 10, 30];

export default function CompetitionContestantProfilePage() {
  const params = useParams();
  const competitionId = params?.id;
  const contestantKeyParam = decodeURIComponent(
    String(params?.contestantKey || '')
  )
    .trim()
    .toLowerCase();

  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [requestedVotes, setRequestedVotes] = useState(1);

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
        setMessage(data?.message || 'Unable to load contestant profile');
        setCompetition(null);
        return;
      }

      setCompetition(data.competition || null);
      const packages = data.competition?.votePackages || [];
      if (packages.length > 0) {
        setSelectedPackageId((prev) => prev || String(packages[0]._id));
      }
      setMessage('');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  const contestant = useMemo(() => {
    const list = competition?.contestants || [];
    return (
      list.find(
        (item) =>
          String(item?.key || '')
            .trim()
            .toLowerCase() === contestantKeyParam
      ) || null
    );
  }, [competition, contestantKeyParam]);

  const canVote = useMemo(() => {
    if (!competition) return false;
    const now = Date.now();
    const start = new Date(competition.startDateTime).getTime();
    const end = new Date(competition.endDateTime).getTime();
    return now >= start && now <= end;
  }, [competition]);

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

  const shareProfile = async () => {
    setShareMessage('');
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${contestant?.fullName || 'Contestant'} profile`,
          text: 'Vote directly from this contestant profile.',
          url,
        });
        setShareMessage('Profile link shared successfully.');
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareMessage('Profile link copied to clipboard.');
    } catch {
      setShareMessage('Could not share profile link right now.');
    }
  };

  const openSocialShare = (platform) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      `Vote for ${contestant?.fullName || 'this contestant'} on ${competition?.title || 'NimblyPolls'}`
    );

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
      return;
    }

    if (platform === 'facebook') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        '_blank'
      );
      return;
    }

    navigator.clipboard
      .writeText(window.location.href)
      .then(() => setShareMessage('Profile link copied for Instagram/TikTok.'))
      .catch(() =>
        setShareMessage('Could not copy profile link for Instagram/TikTok.')
      );
  };

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <Link
          href={`/competitions/${competitionId}`}
          className="mb-5 inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Competition
        </Link>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading contestant profile...
          </div>
        ) : null}

        {shareMessage ? (
          <div className="mb-4 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-foreground">
            {shareMessage}
          </div>
        ) : null}

        {!loading && competition && contestant ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-border bg-card/85 p-5">
              <div className="mb-4 overflow-hidden rounded-xl border border-border bg-background/60">
                {contestant.profileImageUrl ? (
                  <img
                    src={contestant.profileImageUrl}
                    alt={contestant.fullName}
                    className="h-72 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center text-muted-foreground">
                    <UserRound className="h-12 w-12" />
                  </div>
                )}
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {contestant.category}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-foreground">
                {contestant.fullName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Current votes: {Math.max(0, Number(contestant.votes || 0))}
              </p>

              <button
                type="button"
                onClick={shareProfile}
                className="mt-4 inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
              >
                <Share2 className="mr-1.5 h-4 w-4" />
                Share Contestant Profile
              </button>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openSocialShare('whatsapp')}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                >
                  Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => openSocialShare('facebook')}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                >
                  Share on Facebook
                </button>
                <button
                  type="button"
                  onClick={() => openSocialShare('instagram')}
                  className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                >
                  Copy Link for Instagram / TikTok
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-card/85 p-5">
              <h2 className="text-xl font-semibold text-foreground">
                Vote for this contestant
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete your vote directly from this profile page.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Vote package
                  </label>
                  <select
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                  >
                    {votePackages.map((pkg) => (
                      <option key={pkg._id} value={String(pkg._id)}>
                        {pkg.name} • {pkg.votes} vote{pkg.votes > 1 ? 's' : ''}{' '}
                        • {formatKsh(pkg.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
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
                    className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {VOTE_COUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRequestedVotes(preset)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          desiredVotes === preset
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground'
                        }`}
                        disabled={preset > maxVotesPerTxn}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Rate:</strong> KSh{' '}
                    {Number(perVoteCost || 0).toFixed(2)} per vote
                  </p>
                  <p>
                    <strong className="text-foreground">Total:</strong>{' '}
                    {formatKsh(totalAmount)}
                  </p>
                </div>

                <div className="pt-2">
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
                      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      buttonLabel="Vote for Contestant"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center rounded-lg bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground"
                    >
                      <Vote className="mr-1.5 h-4 w-4" />
                      Voting closed
                    </button>
                  )}
                </div>
              </div>
            </article>
          </div>
        ) : null}

        {!loading && (!competition || !contestant) ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/80 p-6 text-sm text-muted-foreground">
            {message || 'Contestant profile not found.'}
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
