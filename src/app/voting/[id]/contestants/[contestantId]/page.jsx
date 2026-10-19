'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, Share2, Trophy, Vote } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function CampaignContestantProfilePage() {
  const params = useParams();
  const campaignId = params?.id;
  const contestantId = String(params?.contestantId || '');

  const [campaign, setCampaign] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const [campaignResponse, resultsResponse] = await Promise.all([
        fetch(`/api/voting/campaigns/${campaignId}`, { cache: 'no-store' }),
        fetch(`/api/voting/campaigns/${campaignId}/results`, {
          cache: 'no-store',
        }),
      ]);

      const campaignData = await campaignResponse.json();
      const resultsData = await resultsResponse.json();

      if (!campaignResponse.ok || !campaignData?.success) {
        setMessage(
          campaignData?.message || 'Unable to load contestant profile'
        );
        setCampaign(null);
        return;
      }

      setCampaign(campaignData.campaign || null);
      setHasVoted(Boolean(campaignData.hasVoted));
      setResults(
        resultsResponse.ok && resultsData?.success
          ? resultsData.results || []
          : []
      );

      setMessage('');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const contestants = campaign?.contestants || campaign?.nominees || [];
  const contestant = contestants.find(
    (item) => String(item._id) === contestantId
  );

  const result = useMemo(
    () => results.find((item) => String(item._id) === contestantId) || null,
    [results, contestantId]
  );

  const canVote = useMemo(() => {
    if (!campaign) return false;
    const now = Date.now();
    const starts = new Date(campaign.startDateTime).getTime();
    const ends = new Date(campaign.endDateTime).getTime();
    return campaign.status === 'live' && now >= starts && now <= ends;
  }, [campaign]);

  const shareProfile = async () => {
    setShareMessage('');
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${contestant?.name || 'Contestant'} profile`,
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

  const castVote = async () => {
    if (submittingVote || hasVoted) return;
    setSubmittingVote(true);
    try {
      const response = await fetch(`/api/voting/campaigns/${campaignId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeId: contestantId }),
      });
      const data = await response.json();
      setMessage(data.message || 'Unable to cast vote');
      if (response.ok && data?.success) {
        setHasVoted(true);
        await load();
      }
    } finally {
      setSubmittingVote(false);
    }
  };

  const openSocialShare = (platform) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      `Vote for ${contestant?.name || 'this contestant'} on ${campaign?.title || 'NimblyPolls'}`
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
          href={`/voting/${campaignId}`}
          className="mb-5 inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Campaign
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

        {!loading && campaign && contestant ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-border bg-card/85 p-5">
              {contestant.imageUrl ? (
                <div className="relative mb-5 h-64 w-full overflow-hidden rounded-xl border border-border">
                  <Image
                    src={contestant.imageUrl}
                    alt={`${contestant.name} photo`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1280px) 100vw, 40vw"
                    unoptimized
                  />
                </div>
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {campaign.category}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-foreground">
                {contestant.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {contestant.tagline || 'Contestant'}
              </p>

              <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Campaign:</strong>{' '}
                  {campaign.title}
                </p>
                <p>
                  <strong className="text-foreground">Votes:</strong>{' '}
                  {Number(result?.voteCount ?? contestant?.voteCount ?? 0)}
                </p>
              </div>

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
              <h2 className="inline-flex items-center text-xl font-semibold text-foreground">
                <Trophy className="mr-2 h-5 w-5 text-primary" />
                Vote for this contestant
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Cast exactly one free vote directly from this profile page.
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
                  <strong className="text-foreground">Vote limit:</strong> 1
                  vote per user
                </div>

                <div className="pt-2">
                  {canVote ? (
                    <button
                      type="button"
                      onClick={castVote}
                      disabled={hasVoted || submittingVote}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      <Vote className="mr-1.5 h-4 w-4" />
                      {submittingVote ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Recording vote...
                        </>
                      ) : hasVoted ? (
                        'Vote already recorded'
                      ) : (
                        'Vote for Contestant'
                      )}
                    </button>
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

        {!loading && (!campaign || !contestant) ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/80 p-6 text-sm text-muted-foreground">
            {message || 'Contestant profile not found.'}
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
