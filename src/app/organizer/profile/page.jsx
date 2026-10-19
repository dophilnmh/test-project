'use client';

import { useEffect, useState } from 'react';
import { Building2, Mail, MapPin, Phone, UserCircle2 } from 'lucide-react';

export default function OrganizerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [organizer, setOrganizer] = useState(null);

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
          setError(data.message || 'Unable to load organizer profile');
          return;
        }

        setOrganizer(data.organizer || null);
      } catch {
        setError('Unable to load organizer profile from database.');
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
          Organizer Profile
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Account details
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Profile data is fetched from your organizer account record in the
          database.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-border bg-card/80 p-5">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Organization:{' '}
              <span className="font-semibold text-foreground">
                {organizer?.organizationName || '-'}
              </span>
            </p>
            <p className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
              <UserCircle2 className="h-4 w-4 text-primary" />
              Contact:{' '}
              <span className="font-semibold text-foreground">
                {organizer?.contactName || '-'}
              </span>
            </p>
            <p className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              Email:{' '}
              <span className="font-semibold text-foreground">
                {organizer?.email || '-'}
              </span>
            </p>
            <p className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-muted-foreground">
              <Phone className="h-4 w-4 text-primary" />
              Phone:{' '}
              <span className="font-semibold text-foreground">
                {organizer?.phone || '-'}
              </span>
            </p>
            <p className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-muted-foreground md:col-span-2">
              <MapPin className="h-4 w-4 text-primary" />
              Location:{' '}
              <span className="font-semibold text-foreground">
                {organizer?.county || '-'} / {organizer?.subCounty || '-'}
              </span>
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
