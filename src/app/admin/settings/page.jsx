'use client';

import { useEffect, useState } from 'react';
import { BellRing, Save, Smartphone } from 'lucide-react';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    notificationPhone: '',
    notificationEmailEnabled: true,
    notificationSmsEnabled: false,
    merchandiseCommissionPercent: 15,
    votingCommissionPercent: 20,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/settings', {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setError(data.message || 'Unable to load settings');
          return;
        }
        setForm(data.profile);
      } catch {
        setError('Unable to load profile settings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to save settings');
        return;
      }
      setForm(data.profile);
      setFeedback('Settings saved successfully.');
    } catch {
      setError('Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-linear-to-br from-card via-card/90 to-background p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Superadmin Settings
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Profile notification preferences
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set the mobile number and channels used when new organizer events are
          submitted.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Name
            </label>
            <input
              value={form.name || ''}
              disabled
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm opacity-80"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </label>
            <input
              value={form.email || ''}
              disabled
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm opacity-80"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Mobile number for SMS
            </label>
            <input
              value={form.notificationPhone || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  notificationPhone: e.target.value,
                }))
              }
              placeholder="07XXXXXXXX"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={Boolean(form.notificationEmailEnabled)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  notificationEmailEnabled: e.target.checked,
                }))
              }
            />
            <BellRing className="h-4 w-4 text-primary" /> Email notifications
            for new events
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={Boolean(form.notificationSmsEnabled)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  notificationSmsEnabled: e.target.checked,
                }))
              }
            />
            <Smartphone className="h-4 w-4 text-primary" /> SMS notifications
            for new events
          </label>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Merchandise Platform Commission (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.merchandiseCommissionPercent ?? 15}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  merchandiseCommissionPercent: e.target.value,
                }))
              }
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Voting Platform Commission (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.votingCommissionPercent ?? 20}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  votingCommissionPercent: e.target.value,
                }))
              }
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );
}
