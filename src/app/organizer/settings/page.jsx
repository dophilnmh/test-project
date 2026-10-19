'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  BellRing,
  Plus,
  Save,
  Shield,
  Ticket,
  Vote,
  Trash2,
  UserCog,
} from 'lucide-react';

function emptyTicketType() {
  return {
    name: '',
    defaultPrice: 0,
    defaultSlots: 0,
    isActive: true,
  };
}

function emptyPromoter() {
  return {
    name: '',
    email: '',
    phone: '',
    accessLevel: 'viewer',
    canManageTickets: false,
    canViewAnalytics: true,
    isActive: true,
  };
}

function emptyVotePackage() {
  return {
    name: '',
    votes: 1,
    price: 20,
    isActive: true,
  };
}

const DEFAULT_TICKET_TYPE_OPTIONS = [
  'vip',
  'regular',
  'early-bird',
  'vvip',
  'student',
];

export default function OrganizerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [settings, setSettings] = useState({
    notificationSmsEnabled: false,
    ticketTypes: [emptyTicketType()],
    votePackages: [emptyVotePackage()],
    calendar: {
      timezone: 'Africa/Nairobi',
      weekStartsOn: 'monday',
      defaultEventDurationHours: 4,
    },
  });

  const [promoters, setPromoters] = useState([emptyPromoter()]);

  const ticketTypeNameOptions = useMemo(() => {
    const fromSettings = (settings.ticketTypes || [])
      .map((item) =>
        String(item?.name || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
    return Array.from(
      new Set([...DEFAULT_TICKET_TYPE_OPTIONS, ...fromSettings])
    );
  }, [settings.ticketTypes]);

  const activePromoters = useMemo(
    () => promoters.filter((item) => item.isActive).length,
    [promoters]
  );

  const loadSettings = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/organizer/settings', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to load organizer settings');
        return;
      }

      setSettings({
        notificationSmsEnabled: Boolean(data.settings?.notificationSmsEnabled),
        ticketTypes:
          Array.isArray(data.settings?.ticketTypes) &&
          data.settings.ticketTypes.length > 0
            ? data.settings.ticketTypes
            : [emptyTicketType()],
        votePackages:
          Array.isArray(data.settings?.votePackages) &&
          data.settings.votePackages.length > 0
            ? data.settings.votePackages
            : [emptyVotePackage()],
        calendar: {
          timezone: data.settings?.calendar?.timezone || 'Africa/Nairobi',
          weekStartsOn:
            data.settings?.calendar?.weekStartsOn === 'sunday'
              ? 'sunday'
              : 'monday',
          defaultEventDurationHours: Number(
            data.settings?.calendar?.defaultEventDurationHours || 4
          ),
        },
      });

      setPromoters(
        Array.isArray(data.promoters) && data.promoters.length > 0
          ? data.promoters
          : [emptyPromoter()]
      );
    } catch {
      setError('Could not fetch organizer settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/organizer/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, promoters }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to save organizer settings');
        return;
      }

      setFeedback('Settings saved. Create Event now uses your ticket types.');
      setSettings({
        notificationSmsEnabled: Boolean(data.settings?.notificationSmsEnabled),
        notificationSmsEnabled: Boolean(data.settings?.notificationSmsEnabled),
        ticketTypes:
          Array.isArray(data.settings?.ticketTypes) &&
          data.settings.ticketTypes.length > 0
            ? data.settings.ticketTypes
            : [emptyTicketType()],
        votePackages:
          Array.isArray(data.settings?.votePackages) &&
          data.settings.votePackages.length > 0
            ? data.settings.votePackages
            : [emptyVotePackage()],
        calendar: {
          timezone: data.settings?.calendar?.timezone || 'Africa/Nairobi',
          weekStartsOn:
            data.settings?.calendar?.weekStartsOn === 'sunday'
              ? 'sunday'
              : 'monday',
          defaultEventDurationHours: Number(
            data.settings?.calendar?.defaultEventDurationHours || 4
          ),
        },
      });
      setPromoters(
        Array.isArray(data.promoters) && data.promoters.length > 0
          ? data.promoters
          : [emptyPromoter()]
      );
    } catch {
      setError('Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-linear-to-br from-card via-card/90 to-background p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Organizer Settings
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Ticket types, calendar and promoter access
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Configure reusable ticket types for your events, set default calendar
          behavior, choose whether organizer updates can arrive by SMS, and
          assign promoters with limited access permissions.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Communications
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              SMS notifications
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn this on if you want platform updates and approvals to be sent
              to your phone as SMS.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={Boolean(settings.notificationSmsEnabled)}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  notificationSmsEnabled: e.target.checked,
                }))
              }
            />
            <BellRing className="h-4 w-4 text-primary" />
            Enable SMS
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Ticket className="h-4 w-4 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Ticket Types
          </p>
          <p className="text-xl font-semibold text-foreground">
            {settings.ticketTypes.length}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Calendar className="h-4 w-4 text-accent" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Timezone
          </p>
          <p className="text-xl font-semibold text-foreground">
            {settings.calendar.timezone}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <Vote className="h-4 w-4 text-warning" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Vote Packages
          </p>
          <p className="text-xl font-semibold text-foreground">
            {settings.votePackages.length}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-4">
          <UserCog className="h-4 w-4 text-success" />
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Active Promoters
          </p>
          <p className="text-xl font-semibold text-foreground">
            {activePromoters}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Vote className="h-4 w-4 text-warning" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Competition Vote Prices
              </h2>
              <p className="text-sm text-muted-foreground">
                Set reusable vote packages used as defaults when creating
                competition events.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                votePackages: [...prev.votePackages, emptyVotePackage()],
              }))
            }
            className="inline-flex items-center rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add package
          </button>
        </div>

        <div className="space-y-3">
          {settings.votePackages.map((item, idx) => (
            <div
              key={`vote-package-${idx}`}
              className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-12"
            >
              <input
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-4"
                placeholder="Package name"
                value={item.name}
                onChange={(e) =>
                  setSettings((prev) => {
                    const next = [...prev.votePackages];
                    next[idx] = { ...next[idx], name: e.target.value };
                    return { ...prev, votePackages: next };
                  })
                }
              />
              <input
                type="number"
                min="1"
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                placeholder="Votes"
                value={item.votes}
                onChange={(e) =>
                  setSettings((prev) => {
                    const next = [...prev.votePackages];
                    next[idx] = {
                      ...next[idx],
                      votes: Math.max(1, Number(e.target.value || 1)),
                    };
                    return { ...prev, votePackages: next };
                  })
                }
              />
              <input
                type="number"
                min="1"
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                placeholder="Price KSh"
                value={item.price}
                onChange={(e) =>
                  setSettings((prev) => {
                    const next = [...prev.votePackages];
                    next[idx] = {
                      ...next[idx],
                      price: Math.max(1, Number(e.target.value || 1)),
                    };
                    return { ...prev, votePackages: next };
                  })
                }
              />
              <div className="flex items-center justify-between gap-2 md:col-span-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(item.isActive)}
                    onChange={(e) =>
                      setSettings((prev) => {
                        const next = [...prev.votePackages];
                        next[idx] = {
                          ...next[idx],
                          isActive: e.target.checked,
                        };
                        return { ...prev, votePackages: next };
                      })
                    }
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      votePackages: prev.votePackages.filter(
                        (_, i) => i !== idx
                      ),
                    }))
                  }
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Ticket Types
            </h2>
            <p className="text-sm text-muted-foreground">
              These appear in organizer event creation as default tier rows.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                ticketTypes: [...prev.ticketTypes, emptyTicketType()],
              }))
            }
            className="inline-flex items-center rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add type
          </button>
        </div>

        <div className="space-y-3">
          {settings.ticketTypes.map((item, idx) => (
            <div
              key={`ticket-type-${idx}`}
              className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-12"
            >
              <input
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-4"
                list={`ticket-type-options-${idx}`}
                placeholder="Select or type ticket type"
                value={item.name}
                onChange={(e) =>
                  setSettings((prev) => {
                    const next = [...prev.ticketTypes];
                    next[idx] = {
                      ...next[idx],
                      name: e.target.value.trim().toLowerCase(),
                    };
                    return { ...prev, ticketTypes: next };
                  })
                }
              />
              <datalist id={`ticket-type-options-${idx}`}>
                {ticketTypeNameOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <input
                type="number"
                min="0"
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                placeholder="Default price"
                value={item.defaultPrice}
                onChange={(e) =>
                  setSettings((prev) => {
                    const next = [...prev.ticketTypes];
                    next[idx] = {
                      ...next[idx],
                      defaultPrice: Number(e.target.value || 0),
                    };
                    return { ...prev, ticketTypes: next };
                  })
                }
              />
              <input
                type="number"
                min="0"
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                placeholder="Default slots"
                value={item.defaultSlots}
                onChange={(e) =>
                  setSettings((prev) => {
                    const next = [...prev.ticketTypes];
                    next[idx] = {
                      ...next[idx],
                      defaultSlots: Number(e.target.value || 0),
                    };
                    return { ...prev, ticketTypes: next };
                  })
                }
              />
              <div className="flex items-center justify-between gap-2 md:col-span-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(item.isActive)}
                    onChange={(e) =>
                      setSettings((prev) => {
                        const next = [...prev.ticketTypes];
                        next[idx] = {
                          ...next[idx],
                          isActive: e.target.checked,
                        };
                        return { ...prev, ticketTypes: next };
                      })
                    }
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      ticketTypes: prev.ticketTypes.filter((_, i) => i !== idx),
                    }))
                  }
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <h2 className="text-xl font-semibold text-foreground">
            Calendar Defaults
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Timezone
            </label>
            <input
              className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
              value={settings.calendar.timezone}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  calendar: { ...prev.calendar, timezone: e.target.value },
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Week starts on
            </label>
            <select
              className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
              value={settings.calendar.weekStartsOn}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  calendar: {
                    ...prev.calendar,
                    weekStartsOn:
                      e.target.value === 'sunday' ? 'sunday' : 'monday',
                  },
                }))
              }
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Default duration (hours)
            </label>
            <input
              type="number"
              min="1"
              max="24"
              className="w-full rounded border border-input bg-background px-2 py-2 text-sm"
              value={settings.calendar.defaultEventDurationHours}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  calendar: {
                    ...prev.calendar,
                    defaultEventDurationHours: Number(e.target.value || 4),
                  },
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-success" />
            <h2 className="text-xl font-semibold text-foreground">
              Promoter Access (Limited)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setPromoters((prev) => [...prev, emptyPromoter()])}
            className="inline-flex items-center rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add promoter
          </button>
        </div>

        <div className="space-y-3">
          {promoters.map((item, idx) => (
            <div
              key={`promoter-${idx}`}
              className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-12"
            >
              <input
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                placeholder="Name"
                value={item.name}
                onChange={(e) =>
                  setPromoters((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], name: e.target.value };
                    return next;
                  })
                }
              />
              <input
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                placeholder="Email"
                value={item.email}
                onChange={(e) =>
                  setPromoters((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], email: e.target.value };
                    return next;
                  })
                }
              />
              <input
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                placeholder="Phone"
                value={item.phone}
                onChange={(e) =>
                  setPromoters((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], phone: e.target.value };
                    return next;
                  })
                }
              />
              <select
                className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                value={item.accessLevel}
                onChange={(e) =>
                  setPromoters((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], accessLevel: e.target.value };
                    return next;
                  })
                }
              >
                <option value="viewer">Viewer</option>
                <option value="sales">Sales</option>
                <option value="editor">Editor</option>
              </select>

              <div className="flex items-center gap-3 md:col-span-2">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(item.canManageTickets)}
                    onChange={(e) =>
                      setPromoters((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...next[idx],
                          canManageTickets: e.target.checked,
                        };
                        return next;
                      })
                    }
                  />
                  Tickets
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(item.canViewAnalytics)}
                    onChange={(e) =>
                      setPromoters((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...next[idx],
                          canViewAnalytics: e.target.checked,
                        };
                        return next;
                      })
                    }
                  />
                  Analytics
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 md:col-span-1">
                <button
                  type="button"
                  onClick={() =>
                    setPromoters((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}

      <button
        type="button"
        onClick={saveSettings}
        disabled={loading || saving}
        className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Saving settings...' : 'Save organizer settings'}
      </button>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      ) : null}
    </div>
  );
}
