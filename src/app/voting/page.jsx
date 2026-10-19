'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock3, Vote } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

function getCountdownText(dateValue, nowMs) {
  const now = new Date(nowMs);
  const target = new Date(dateValue);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return `${String(days).padStart(2, '0')} Days : ${String(hours).padStart(2, '0')} Hours : ${String(mins).padStart(2, '0')} Minutes : ${String(secs).padStart(2, '0')} Seconds`;
}

export default function VotingPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/voting/campaigns', {
          cache: 'no-store',
        });
        const data = await response.json();
        if (response.ok && data?.success) {
          setCampaigns(data.campaigns || []);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const featuredCampaign = useMemo(
    () => campaigns.find((item) => item.status === 'live') || campaigns[0],
    [campaigns]
  );

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Polls
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              Featured Poll
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              One main event, with contestants organized into clear categories.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading featured poll...
          </div>
        ) : null}

        {!loading && featuredCampaign ? (
          <article className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/85">
            {featuredCampaign.bannerUrl ? (
              <div className="relative h-48 w-full bg-background md:h-72">
                <Image
                  src={featuredCampaign.bannerUrl}
                  alt={`${featuredCampaign.title} banner`}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between md:p-7">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {featuredCampaign.category || 'Poll'}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {featuredCampaign.status.toUpperCase()}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold text-foreground md:text-3xl">
                  {featuredCampaign.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {featuredCampaign.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {getCountdownText(featuredCampaign.endDateTime, now)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Vote className="h-4 w-4 text-primary" />
                    {
                      (
                        featuredCampaign.contestants ||
                        featuredCampaign.nominees ||
                        []
                      ).length
                    }{' '}
                    contestants
                  </span>
                </div>
              </div>
              <Link
                href={`/voting/${featuredCampaign._id}`}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                {featuredCampaign.status === 'ended'
                  ? 'View Results'
                  : 'Open Poll'}
              </Link>
            </div>
          </article>
        ) : !loading ? (
          <div className="rounded-xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
            No polls are available right now.
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
