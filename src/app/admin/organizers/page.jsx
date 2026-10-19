'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  Phone,
  Search,
  Trash2,
} from 'lucide-react';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminOrganizersPage() {
  const [organizers, setOrganizers] = useState([]);
  const [summary, setSummary] = useState({
    organizers: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    totalEvents: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 8,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [pageSize, setPageSize] = useState(8);
  const [pageJump, setPageJump] = useState('1');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [canDeleteOrganizers, setCanDeleteOrganizers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const requestControllerRef = useRef(null);

  const loadOrganizers = useCallback(
    async ({ page, q, status, limit, silent = false }) => {
      if (!silent) setLoading(true);
      setError('');

      if (requestControllerRef.current) {
        requestControllerRef.current.abort();
      }

      const controller = new AbortController();
      requestControllerRef.current = controller;

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          q,
          status,
        });

        const response = await fetch(
          `/api/admin/organizers?${params.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.message || 'Unable to load organizers');
          return;
        }

        setOrganizers(data.organizers || []);
        setCanDeleteOrganizers(Boolean(data.canDeleteOrganizers));
        setPagination(
          data.pagination || {
            page: 1,
            limit,
            totalItems: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          }
        );
        setSummary(
          data.summary || {
            organizers: 0,
            active: 0,
            pending: 0,
            suspended: 0,
            totalEvents: 0,
          }
        );
        setSelectedIds([]);
      } catch (requestError) {
        if (requestError?.name !== 'AbortError') {
          setError('Request failed. Please try again.');
        }
      } finally {
        if (!silent && requestControllerRef.current === controller) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadOrganizers({
      page: 1,
      q: query,
      status: statusFilter,
      limit: pageSize,
    });
  }, [query, statusFilter, pageSize, loadOrganizers]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    setPageJump(String(pagination.page || 1));
  }, [pagination.page]);

  const goToPage = useCallback(
    (nextPage) => {
      if (nextPage < 1 || nextPage > pagination.totalPages) return;
      loadOrganizers({
        page: nextPage,
        q: query,
        status: statusFilter,
        limit: pageSize,
      });
    },
    [loadOrganizers, pagination.totalPages, pageSize, query, statusFilter]
  );

  const applyOptimisticStatus = useCallback(
    (targetIds, nextStatus) => {
      const targetSet = new Set(targetIds);
      setOrganizers((prev) =>
        prev.map((item) =>
          targetSet.has(item.id) ? { ...item, status: nextStatus } : item
        )
      );

      setSummary((prev) => {
        let active = Number(prev.active || 0);
        let pending = Number(prev.pending || 0);
        let suspended = Number(prev.suspended || 0);

        organizers.forEach((item) => {
          if (!targetSet.has(item.id) || item.status === nextStatus) return;

          if (item.status === 'active') active -= 1;
          if (item.status === 'pending') pending -= 1;
          if (item.status === 'suspended') suspended -= 1;

          if (nextStatus === 'active') active += 1;
          if (nextStatus === 'pending') pending += 1;
          if (nextStatus === 'suspended') suspended += 1;
        });

        return {
          ...prev,
          active: Math.max(0, active),
          pending: Math.max(0, pending),
          suspended: Math.max(0, suspended),
        };
      });
    },
    [organizers]
  );

  const updateStatus = useCallback(
    async (targetIds, nextStatus) => {
      if (!targetIds.length) return;

      setFeedback('');
      setError('');
      setUpdating(true);

      const previousOrganizers = organizers;
      const previousSummary = summary;

      applyOptimisticStatus(targetIds, nextStatus);

      try {
        const payload =
          targetIds.length === 1
            ? { organizerId: targetIds[0], status: nextStatus }
            : { organizerIds: targetIds, status: nextStatus };

        const response = await fetch('/api/admin/organizers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          setOrganizers(previousOrganizers);
          setSummary(previousSummary);
          setError(data.message || 'Unable to update organizer status');
          return;
        }

        setFeedback(data.message || 'Organizer status updated');
        if (targetIds.length > 1) {
          setSelectedIds([]);
        }
        await loadOrganizers({
          page: pagination.page,
          q: query,
          status: statusFilter,
          limit: pageSize,
          silent: true,
        });
      } catch {
        setOrganizers(previousOrganizers);
        setSummary(previousSummary);
        setError('Status update request failed. Please try again.');
      } finally {
        setUpdating(false);
      }
    },
    [
      applyOptimisticStatus,
      loadOrganizers,
      organizers,
      pagination.page,
      query,
      statusFilter,
      pageSize,
      summary,
    ]
  );

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const deleteOrganizers = async (targetIds) => {
    if (!canDeleteOrganizers || !targetIds.length) return;
    const count = targetIds.length;
    const confirmed = window.confirm(
      `Permanently delete ${count} organizer account${count === 1 ? '' : 's'}? Their events and payment history will remain.`
    );
    if (!confirmed) return;

    setUpdating(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch('/api/admin/organizers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          count === 1 ? { organizerId: targetIds[0] } : { organizerIds: targetIds }
        ),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to delete organizer accounts.');
        return;
      }
      setFeedback(data.message || 'Organizer account deleted.');
      setSelectedIds([]);
      await loadOrganizers({
        page: pagination.page,
        q: query,
        status: statusFilter,
        limit: pageSize,
      });
    } catch {
      setError('Unable to delete organizer accounts right now.');
    } finally {
      setUpdating(false);
    }
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = organizers.map((item) => item.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const allVisibleSelected =
    organizers.length > 0 &&
    organizers.every((item) => selectedIds.includes(item.id));

  const counts = useMemo(
    () => ({
      organizers: Number(summary.organizers || 0),
      active: Number(summary.active || 0),
      pending: Number(summary.pending || 0),
      suspended: Number(summary.suspended || 0),
      events: Number(summary.totalEvents || 0),
    }),
    [summary]
  );

  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card via-card to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Organizer Directory
            </p>
            <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
              Organizer Accounts
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage organizer accounts, location details, and account status at
              scale.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            Admin View
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Organizers
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {counts.organizers}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Active
          </p>
          <p className="mt-1 text-2xl font-semibold text-success">
            {counts.active}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Pending
          </p>
          <p className="mt-1 text-2xl font-semibold text-warning">
            {counts.pending}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Suspended
          </p>
          <p className="mt-1 text-2xl font-semibold text-destructive">
            {counts.suspended}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Total Events
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {counts.events}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card/85 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm"
              placeholder="Search organization, contact, county, or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <select
              className="bg-transparent outline-none"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
            <span>Rows</span>
            <select
              className="bg-transparent outline-none"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </label>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/85 p-4">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            disabled={loading || !organizers.length}
          />
          Select all visible
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => updateStatus(selectedIds, 'active')}
            disabled={updating || !selectedIds.length}
            className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-success disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bulk Activate
          </button>
          <button
            onClick={() => updateStatus(selectedIds, 'suspended')}
            disabled={updating || !selectedIds.length}
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bulk Suspend
          </button>
          {canDeleteOrganizers ? (
            <button
              type="button"
              onClick={() => deleteOrganizers(selectedIds)}
              disabled={updating || !selectedIds.length}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
          ) : null}
        </div>
      </section>

      {feedback ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
            Loading organizers...
          </div>
        ) : organizers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
            No organizer accounts match your filters.
          </div>
        ) : (
          organizers.map((organizer) => (
            <article
              key={organizer.id}
              className="rounded-xl border border-border bg-card/90 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="inline-flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border"
                    checked={selectedIds.includes(organizer.id)}
                    onChange={() => toggleSelected(organizer.id)}
                    disabled={updating}
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {organizer.organizationName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Contact: {organizer.contactName || '-'}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    organizer.status === 'active'
                      ? 'bg-success/15 text-success'
                      : organizer.status === 'suspended'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-warning/15 text-warning'
                  }`}
                >
                  {organizer.status || 'active'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
                <p className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  {organizer.email}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  {organizer.phone || '-'}
                </p>
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {organizer.county || '-'} / {organizer.subCounty || '-'}
                </p>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Joined {formatDate(organizer.createdAt)}
                </p>
              </div>

              <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                  Total Events: {organizer.totalEvents || 0}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                  Approved: {organizer.approvedEvents || 0}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                  Pending: {organizer.pendingEvents || 0}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => updateStatus([organizer.id], 'active')}
                  disabled={updating || organizer.status === 'active'}
                  className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-success disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Activate
                </button>
                <button
                  onClick={() => updateStatus([organizer.id], 'suspended')}
                  disabled={updating || organizer.status === 'suspended'}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suspend
                </button>
                {canDeleteOrganizers ? (
                  <button
                    type="button"
                    onClick={() => deleteOrganizers([organizer.id])}
                    disabled={updating}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete account
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/85 p-4">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages} •{' '}
          {pagination.totalItems} records
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={!pagination.hasPrevPage || loading || updating}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <span className="uppercase tracking-widest">Go to</span>
            <input
              type="number"
              min={1}
              max={pagination.totalPages}
              value={pageJump}
              onChange={(event) => setPageJump(event.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
            />
            <button
              onClick={() => {
                const target = Number(pageJump);
                if (Number.isFinite(target)) {
                  goToPage(target);
                }
              }}
              disabled={loading || updating}
              className="rounded border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest text-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Go
            </button>
          </label>

          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={!pagination.hasNextPage || loading || updating}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </section>
  );
}
