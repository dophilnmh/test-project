'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { ImageCropUploadField } from '@/components/ui/ImageCropUploadField';

const EMPTY_CONTESTANT = {
  fullName: '',
  category: '',
  profileImageUrl: '',
  votes: 0,
};

const EMPTY_VOTE_PACKAGE = {
  name: '',
  votes: 1,
  price: 10,
  isActive: true,
};

const initialForm = {
  organizerId: '',
  title: '',
  description: '',
  category: '',
  venue: '',
  city: '',
  bannerUrl: '',
  startDateTime: '',
  endDateTime: '',
  status: 'approved',
  rejectionReason: '',
  publicVoteDisplay: 'count',
  maxVotesPerTransaction: 1000,
  contestants: [{ ...EMPTY_CONTESTANT }],
  votePackages: [{ ...EMPTY_VOTE_PACKAGE }],
};

function toLocalDateTimeInput(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const offset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeContestants(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      fullName: String(row?.fullName || '').trim(),
      category: String(row?.category || '').trim(),
      profileImageUrl: String(row?.profileImageUrl || '').trim(),
      votes: Math.max(0, Number(row?.votes || 0)),
    }))
    .filter((item) => item.fullName && item.category);
}

function normalizeVotePackages(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      name: String(row?.name || '').trim(),
      votes: Math.max(1, Math.round(Number(row?.votes || 1))),
      price: Math.max(1, Math.round(Number(row?.price || 1))),
      isActive: row?.isActive !== false,
    }))
    .filter((item) => item.name);
}

export default function AdminCompetitionsCrudPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [competitions, setCompetitions] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState({
    id: '',
    title: '',
    open: false,
  });
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState({
    id: '',
    title: '',
    open: false,
  });
  const [deleteOtp, setDeleteOtp] = useState('');
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingContestantKey, setUploadingContestantKey] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [competitionsResponse, organizersResponse] = await Promise.all([
        fetch('/api/admin/competitions', { cache: 'no-store' }),
        fetch('/api/admin/organizers?page=1&limit=100&status=all', {
          cache: 'no-store',
        }),
      ]);

      const competitionsData = await competitionsResponse.json();
      const organizersData = await organizersResponse.json();

      if (!competitionsResponse.ok || !competitionsData?.success) {
        setError(competitionsData?.message || 'Unable to load competitions');
        return;
      }

      if (!organizersResponse.ok || !organizersData?.success) {
        setError(organizersData?.message || 'Unable to load organizers');
        return;
      }

      setCompetitions(
        Array.isArray(competitionsData.competitions)
          ? competitionsData.competitions
          : []
      );
      setOrganizers(
        Array.isArray(organizersData.organizers)
          ? organizersData.organizers
          : []
      );
    } catch {
      setError('Unable to load superadmin competition workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    return {
      all: competitions.length,
      approved: competitions.filter((item) => item.status === 'approved')
        .length,
      pending: competitions.filter((item) => item.status === 'pending').length,
      rejected: competitions.filter((item) => item.status === 'rejected')
        .length,
    };
  }, [competitions]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId('');
  };

  const loadForEdit = async (id) => {
    if (!id) return;
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(`/api/admin/competitions/${id}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data?.success || !data?.competition) {
        setError(data?.message || 'Unable to load competition details');
        return;
      }

      const item = data.competition;
      const contestants =
        (item.contestants || []).length > 0
          ? item.contestants.map((row) => ({
              fullName: String(row.fullName || ''),
              category: String(row.category || ''),
              profileImageUrl: String(row.profileImageUrl || ''),
              votes: Math.max(0, Number(row.votes || 0)),
            }))
          : [{ ...EMPTY_CONTESTANT }];

      const votePackages =
        (item.votePackages || []).length > 0
          ? item.votePackages.map((row) => ({
              name: String(row.name || ''),
              votes: Math.max(1, Number(row.votes || 1)),
              price: Math.max(1, Number(row.price || 1)),
              isActive: row.isActive !== false,
            }))
          : [{ ...EMPTY_VOTE_PACKAGE }];

      setForm({
        organizerId: String(item.organizerId || ''),
        title: String(item.title || ''),
        description: String(item.description || ''),
        category: String(item.category || ''),
        venue: String(item.venue || ''),
        city: String(item.city || ''),
        bannerUrl: String(item.bannerUrl || ''),
        startDateTime: toLocalDateTimeInput(item.startDateTime),
        endDateTime: toLocalDateTimeInput(item.endDateTime),
        status: String(item.status || 'approved'),
        rejectionReason: String(item.rejectionReason || ''),
        publicVoteDisplay: String(item.publicVoteDisplay || 'count'),
        maxVotesPerTransaction: Math.max(
          1,
          Number(item.maxVotesPerTransaction || 1000)
        ),
        contestants,
        votePackages,
      });
      setEditingId(String(item._id));
    } catch {
      setError('Unable to load competition for editing.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    const contestants = normalizeContestants(form.contestants);
    const votePackages = normalizeVotePackages(form.votePackages);

    if (!form.organizerId) {
      setError('Organizer is required.');
      setSaving(false);
      return;
    }

    if (contestants.length === 0) {
      setError('Add at least one contestant line.');
      setSaving(false);
      return;
    }

    if (!votePackages.some((item) => item.isActive !== false)) {
      setError('Add at least one active vote package line.');
      setSaving(false);
      return;
    }

    const payload = {
      organizerId: String(form.organizerId || '').trim(),
      title: String(form.title || '').trim(),
      description: String(form.description || '').trim(),
      category: String(form.category || '').trim(),
      venue: String(form.venue || '').trim(),
      city: String(form.city || '').trim(),
      bannerUrl: String(form.bannerUrl || '').trim(),
      startDateTime: form.startDateTime,
      endDateTime: form.endDateTime,
      status: String(form.status || 'approved')
        .trim()
        .toLowerCase(),
      rejectionReason: String(form.rejectionReason || '').trim(),
      publicVoteDisplay: String(form.publicVoteDisplay || 'count').trim(),
      maxVotesPerTransaction: Math.max(
        1,
        Math.min(10000, Math.round(Number(form.maxVotesPerTransaction || 1000)))
      ),
      contestants,
      votePackages,
    };

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/competitions/${editingId}`
          : '/api/admin/competitions',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to save competition');
        return;
      }

      setFeedback(editingId ? 'Competition updated.' : 'Competition created.');
      resetForm();
      await load();
    } catch {
      setError('Unable to save competition right now.');
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteOtp = async () => {
    const { id, title } = deleteConfirmTarget;
    if (!id) return;

    setError('');
    setFeedback('');
    setDeleteConfirmTarget({ id: '', title: '', open: false });
    setDeleteTarget({ id, title, open: true });
    setDeleteOtp('');
    setSendingDeleteOtp(true);
    try {
      const otpReq = await fetch(`/api/admin/competitions/${id}/delete-otp`, {
        method: 'POST',
      });
      const otpData = await otpReq.json();
      if (!otpReq.ok || !otpData?.success) {
        setError(otpData?.message || 'Unable to send delete OTP');
        return;
      }

      setFeedback('OTP is ready in your superadmin email.');
    } catch {
      setDeleteTarget({ id: '', title: '', open: false });
      setDeleteOtp('');
      setError('Unable to delete competition right now.');
    } finally {
      setSendingDeleteOtp(false);
    }
  };

  const removeCompetition = (id, title) => {
    if (!id || sendingDeleteOtp || confirmingDelete) return;
    setError('');
    setFeedback('');
    setDeleteConfirmTarget({ id, title, open: true });
  };

  const closeDeleteModal = () => {
    if (sendingDeleteOtp || confirmingDelete) return;
    setDeleteTarget({ id: '', title: '', open: false });
    setDeleteOtp('');
  };

  const resendDeleteOtp = async () => {
    if (!deleteTarget.id) return;

    setError('');
    setFeedback('');
    setSendingDeleteOtp(true);
    try {
      const otpReq = await fetch(
        `/api/admin/competitions/${deleteTarget.id}/delete-otp`,
        {
          method: 'POST',
        }
      );
      const otpData = await otpReq.json();
      if (!otpReq.ok || !otpData?.success) {
        setError(otpData?.message || 'Unable to resend delete OTP');
        return;
      }
      setFeedback('The existing OTP is still valid for 30 minutes.');
    } catch {
      setError('Unable to resend OTP right now.');
    } finally {
      setSendingDeleteOtp(false);
    }
  };

  const confirmDeleteCompetition = async () => {
    if (!deleteTarget.id) return;

    const otp = String(deleteOtp || '').trim();
    if (!otp) {
      setError('OTP is required to delete a competition.');
      return;
    }

    setConfirmingDelete(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(
        `/api/admin/competitions/${deleteTarget.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to delete competition');
        return;
      }

      setFeedback('Competition deleted.');
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget({ id: '', title: '', open: false });
      setDeleteOtp('');
      await load();
    } catch {
      setError('Unable to delete competition right now.');
    } finally {
      setConfirmingDelete(false);
    }
  };

  const addContestant = () => {
    setForm((prev) => ({
      ...prev,
      contestants: [...prev.contestants, { ...EMPTY_CONTESTANT }],
    }));
  };

  const removeContestant = (index) => {
    setForm((prev) => {
      const next = prev.contestants.filter((_, idx) => idx !== index);
      return {
        ...prev,
        contestants: next.length > 0 ? next : [{ ...EMPTY_CONTESTANT }],
      };
    });
  };

  const updateContestant = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      contestants: prev.contestants.map((row, idx) =>
        idx === index
          ? {
              ...row,
              [field]:
                field === 'votes' ? Math.max(0, Number(value || 0)) : value,
            }
          : row
      ),
    }));
  };

  const addVotePackage = () => {
    setForm((prev) => ({
      ...prev,
      votePackages: [...prev.votePackages, { ...EMPTY_VOTE_PACKAGE }],
    }));
  };

  const removeVotePackage = (index) => {
    setForm((prev) => {
      const next = prev.votePackages.filter((_, idx) => idx !== index);
      return {
        ...prev,
        votePackages: next.length > 0 ? next : [{ ...EMPTY_VOTE_PACKAGE }],
      };
    });
  };

  const updateVotePackage = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      votePackages: prev.votePackages.map((row, idx) => {
        if (idx !== index) return row;
        if (field === 'votes')
          return { ...row, votes: Math.max(1, Number(value || 1)) };
        if (field === 'price')
          return { ...row, price: Math.max(1, Number(value || 1)) };
        if (field === 'isActive') return { ...row, isActive: Boolean(value) };
        return { ...row, [field]: value };
      }),
    }));
  };

  const uploadBannerFile = async (file) => {
    if (!file) return;

    setUploadingBanner(true);
    setError('');
    setFeedback('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/uploads/banner', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data?.success || !data?.bannerUrl) {
        setError(data?.message || 'Unable to upload banner image');
        return;
      }

      setForm((prev) => ({ ...prev, bannerUrl: data.bannerUrl }));
      setFeedback('Banner image uploaded.');
    } catch {
      setError('Unable to upload banner image right now.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const uploadContestantImage = async (index, file) => {
    if (!file) return;

    const key = `contestant-${index}`;
    setUploadingContestantKey(key);
    setError('');
    setFeedback('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/uploads/contestant', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data?.success || !data?.imageUrl) {
        setError(data?.message || 'Unable to upload contestant image');
        return;
      }

      updateContestant(index, 'profileImageUrl', data.imageUrl);
      setFeedback('Contestant image uploaded.');
    } catch {
      setError('Unable to upload contestant image right now.');
    } finally {
      setUploadingContestantKey('');
    }
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-border bg-card/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Superadmin
            </p>
            <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
              Competition CRUD Control
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create, edit, publish state, and delete competition events.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Superadmin only
          </span>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            All
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {totals.all}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Approved
          </p>
          <p className="mt-1 text-2xl font-semibold text-success">
            {totals.approved}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Pending
          </p>
          <p className="mt-1 text-2xl font-semibold text-warning">
            {totals.pending}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/85 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Rejected
          </p>
          <p className="mt-1 text-2xl font-semibold text-destructive">
            {totals.rejected}
          </p>
        </article>
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {feedback}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card/85 p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {editingId ? 'Edit Competition' : 'Create Competition'}
          </h2>
          <div className="flex items-center gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
              >
                Cancel Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <select
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={form.organizerId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, organizerId: e.target.value }))
            }
            required
          >
            <option value="">Select organizer</option>
            {organizers.map((org) => (
              <option key={org.id} value={org.id}>
                {org.organizationName} ({org.contactName || 'N/A'})
              </option>
            ))}
          </select>

          <select
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="approved">approved</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </select>

          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
            required
          />

          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
            required
          />

          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Venue"
            value={form.venue}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, venue: e.target.value }))
            }
            required
          />

          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="City"
            value={form.city}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, city: e.target.value }))
            }
            required
          />

          <input
            type="datetime-local"
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={form.startDateTime}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, startDateTime: e.target.value }))
            }
            required
          />

          <input
            type="datetime-local"
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={form.endDateTime}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, endDateTime: e.target.value }))
            }
            required
          />

          <div className="rounded-xl border border-border bg-background/30 p-3 md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Competition banner image
            </label>
            <div className="mt-2">
              <ImageCropUploadField
                label="Competition banner image"
                helperText="Select an image to upload. Auto-cropped to 16:9 landscape."
                disabled={uploadingBanner || saving}
                aspectRatio={16 / 9}
                onCroppedFile={uploadBannerFile}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {uploadingBanner
                ? 'Uploading banner...'
                : 'Select an image file instead of pasting a URL.'}
            </p>
            {form.bannerUrl ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
                <img
                  src={form.bannerUrl}
                  alt="Competition banner preview"
                  className="h-36 w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          <input
            type="number"
            min="1"
            max="10000"
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Max votes per transaction"
            value={form.maxVotesPerTransaction}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                maxVotesPerTransaction: e.target.value,
              }))
            }
          />

          <select
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={form.publicVoteDisplay}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                publicVoteDisplay: e.target.value,
              }))
            }
          >
            <option value="count">Public display: Numerical Votes</option>
            <option value="percent">Public display: Percentage (%)</option>
            <option value="hide">Public display: Hide Vote Figures</option>
          </select>

          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Rejection reason (if rejected)"
            value={form.rejectionReason}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, rejectionReason: e.target.value }))
            }
          />

          <textarea
            className="min-h-20 rounded border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            required
          />

          <div className="space-y-3 rounded-xl border border-border bg-background/30 p-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Contestants
              </label>
              <button
                type="button"
                onClick={addContestant}
                className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add contestant
              </button>
            </div>

            <div className="space-y-2">
              {form.contestants.map((row, index) => (
                <div
                  key={`contestant-${index}`}
                  className="grid gap-2 rounded-lg border border-border/70 bg-background p-2 md:grid-cols-12"
                >
                  <input
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-3"
                    placeholder="Full name"
                    value={row.fullName}
                    onChange={(e) =>
                      updateContestant(index, 'fullName', e.target.value)
                    }
                  />
                  <input
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                    placeholder="Category"
                    value={row.category}
                    onChange={(e) =>
                      updateContestant(index, 'category', e.target.value)
                    }
                  />
                  <div className="md:col-span-5">
                    <ImageCropUploadField
                      label="Contestant image"
                      helperText={
                        uploadingContestantKey === `contestant-${index}`
                          ? 'Uploading contestant image...'
                          : 'Select an image to upload.'
                      }
                      disabled={
                        saving ||
                        uploadingContestantKey === `contestant-${index}`
                      }
                      onCroppedFile={(file) =>
                        uploadContestantImage(index, file)
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {uploadingContestantKey === `contestant-${index}`
                        ? 'Uploading contestant image...'
                        : 'Upload image file'}
                    </p>
                    {row.profileImageUrl ? (
                      <div className="mt-1 overflow-hidden rounded border border-border bg-background">
                        <img
                          src={row.profileImageUrl}
                          alt={row.fullName || 'Contestant'}
                          className="h-12 w-12 object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-1"
                    placeholder="Votes"
                    value={row.votes}
                    onChange={(e) =>
                      updateContestant(index, 'votes', e.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeContestant(index)}
                    className="inline-flex items-center justify-center rounded border border-destructive/40 px-2 py-1.5 text-xs text-destructive md:col-span-1"
                    aria-label="Remove contestant"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-background/30 p-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Vote Packages
              </label>
              <button
                type="button"
                onClick={addVotePackage}
                className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add package
              </button>
            </div>

            <div className="space-y-2">
              {form.votePackages.map((row, index) => (
                <div
                  key={`vote-package-${index}`}
                  className="grid gap-2 rounded-lg border border-border/70 bg-background p-2 md:grid-cols-12"
                >
                  <input
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-4"
                    placeholder="Package name"
                    value={row.name}
                    onChange={(e) =>
                      updateVotePackage(index, 'name', e.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                    placeholder="Votes"
                    value={row.votes}
                    onChange={(e) =>
                      updateVotePackage(index, 'votes', e.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm md:col-span-2"
                    placeholder="Price"
                    value={row.price}
                    onChange={(e) =>
                      updateVotePackage(index, 'price', e.target.value)
                    }
                  />
                  <label className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5 text-xs md:col-span-3">
                    <input
                      type="checkbox"
                      checked={row.isActive !== false}
                      onChange={(e) =>
                        updateVotePackage(index, 'isActive', e.target.checked)
                      }
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVotePackage(index)}
                    className="inline-flex items-center justify-center rounded border border-destructive/40 px-2 py-1.5 text-xs text-destructive md:col-span-1"
                    aria-label="Remove package"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
          >
            <Plus className="mr-1 h-4 w-4" />
            {saving
              ? editingId
                ? 'Updating...'
                : 'Creating...'
              : editingId
                ? 'Update Competition'
                : 'Create Competition'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card/85 p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Existing Competitions
        </h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading competitions...
          </p>
        ) : competitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No competitions found.
          </p>
        ) : (
          <div className="space-y-3">
            {competitions.map((item) => (
              <article
                key={item._id}
                className="rounded-xl border border-border bg-background/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} | {item.organizerName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.contestantsCount || 0} contestants |{' '}
                      {item.totalVotes || 0} votes | {item.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => loadForEdit(item._id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving || sendingDeleteOtp || confirmingDelete}
                      onClick={() => removeCompetition(item._id, item.title)}
                      className="inline-flex items-center rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-semibold text-destructive"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {deleteConfirmTarget.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Confirm Competition Delete
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete{' '}
              <span className="font-semibold text-foreground">
                {deleteConfirmTarget.title}
              </span>{' '}
              permanently? You will need an OTP to complete this action.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirmTarget({ id: '', title: '', open: false })
                }
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestDeleteOtp}
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
              >
                Continue to OTP
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Confirm Competition Delete
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {sendingDeleteOtp
                ? 'Sending the OTP to your superadmin email...'
                : 'Enter the OTP sent to your superadmin email to permanently delete this competition. The OTP remains valid for 30 minutes.'}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {deleteTarget.title}
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              One-time password
            </label>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={deleteOtp}
              onChange={(e) => setDeleteOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              inputMode="numeric"
              disabled={sendingDeleteOtp || confirmingDelete}
            />

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={sendingDeleteOtp || confirmingDelete}
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resendDeleteOtp}
                disabled={sendingDeleteOtp || confirmingDelete}
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
              >
                {sendingDeleteOtp ? 'Sending...' : 'Resend OTP'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteCompetition}
                disabled={confirmingDelete || sendingDeleteOtp}
                className="inline-flex items-center rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
              >
                {confirmingDelete ? 'Deleting...' : 'Delete Competition'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
