'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FileImage } from 'lucide-react';

export default function OrganizerMediaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mediaItems, setMediaItems] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/events/organizer', {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok || !data?.success) {
          setError(data.message || 'Unable to load media items');
          return;
        }

        const events = Array.isArray(data.events) ? data.events : [];
        const items = events
          .filter((event) => event.bannerUrl)
          .map((event) => ({
            id: event._id || event.id,
            title: event.title,
            bannerUrl: event.bannerUrl,
            category: event.category,
            status: event.status,
          }));

        setMediaItems(items);
      } catch {
        setError('Unable to load media from database.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-linear-to-br from-card via-card/90 to-background p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Media Vault
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Uploaded event assets
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          All event banners shown here are loaded from your organizer events in
          the database.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading media...</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mediaItems.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-border bg-card/80"
          >
            <div className="relative aspect-[4/3] w-full bg-background/40">
              <Image
                src={item.bannerUrl}
                alt={item.title}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.category || 'General'} • {item.status}
              </p>
            </div>
          </article>
        ))}
      </section>

      {!loading && !error && mediaItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
          <FileImage className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No uploaded banners found yet.
          </p>
        </div>
      ) : null}
    </div>
  );
}
