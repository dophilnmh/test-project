'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Copy } from 'lucide-react';
import { ImageCropUploadField } from '@/components/ui/ImageCropUploadField';

const STATUS_OPTIONS = ['draft', 'pending', 'live', 'ended', 'archived'];
const POLLS_PER_PAGE = 8;

export default function AdminVotingPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [ticketEvents, setTicketEvents] = useState([]);
  const [ticketEventSelections, setTicketEventSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [copiedTicketLink, setCopiedTicketLink] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingCampaignId, setSavingCampaignId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [pollPage, setPollPage] = useState(1);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingNomineeKey, setUploadingNomineeKey] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    bannerUrl: '',
    startDateTime: '',
    endDateTime: '',
    status: 'draft',
    resultVisibility: 'live',
    publicVoteDisplay: 'count',
    commissionPercent: 20,
    nominees: [
      { name: '', category: 'General', tagline: '', imageUrl: '' },
      { name: '', category: 'General', tagline: '', imageUrl: '' },
    ],
  });

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const [campaignResponse, eventResponse] = await Promise.all([
        fetch('/api/voting/campaigns?scope=admin', { cache: 'no-store' }),
        fetch('/api/events?scope=all', { cache: 'no-store' }),
      ]);
      const [campaignData, eventData] = await Promise.all([
        campaignResponse.json(),
        eventResponse.json(),
      ]);
      if (campaignResponse.ok && campaignData?.success) {
        const nextCampaigns = campaignData.campaigns || [];
        setCampaigns(nextCampaigns);
        setTicketEventSelections((previous) => {
          const next = { ...previous };
          nextCampaigns.forEach((campaign) => {
            next[campaign._id] =
              previous[campaign._id] ?? String(campaign.eventId || '');
          });
          return next;
        });
      } else {
        setFeedback(campaignData?.message || 'Unable to load polls.');
      }
      if (eventResponse.ok && eventData?.success) {
        setTicketEvents(
          (eventData.events || []).filter(
            (event) =>
              event.status === 'approved' &&
              (!event.eventType || event.eventType === 'ticketing')
          )
        );
      } else {
        setFeedback(eventData?.message || 'Unable to load approved ticket events.');
      }
    } catch {
      setFeedback('Unable to load polls and ticket events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const totals = useMemo(() => {
    return {
      totalCampaigns: campaigns.length,
      live: campaigns.filter((item) => item.status === 'live').length,
      totalVotes: campaigns.reduce(
        (sum, item) => sum + Number(item.totalVotes || 0),
        0
      ),
      ended: campaigns.filter((item) => item.status === 'ended').length,
      nominees: campaigns.reduce(
        (sum, item) => sum + (item.nominees || item.contestants || []).length,
        0
      ),
    };
  }, [campaigns]);

  const nomineeTotals = useMemo(() => {
    const map = {};

    campaigns.forEach((campaign) => {
      const nominees = campaign.nominees || campaign.contestants || [];
      nominees.forEach((nominee) => {
        const name = String(nominee?.name || '').trim() || 'Unnamed nominee';
        map[name] = (map[name] || 0) + Number(nominee?.voteCount || 0);
      });
    });

    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [campaigns]);

  const totalPollPages = Math.max(
    1,
    Math.ceil(campaigns.length / POLLS_PER_PAGE)
  );
  const visibleCampaigns = campaigns.slice(
    (pollPage - 1) * POLLS_PER_PAGE,
    pollPage * POLLS_PER_PAGE
  );

  const updateCampaignStatus = async (
    campaignId,
    status,
    commissionPercent,
    publicVoteDisplay,
    ticketEventId
  ) => {
    setFeedback('');
    const campaign = campaigns.find(
      (item) => String(item._id) === String(campaignId)
    );
    const selectedTicketEventId =
      ticketEventId ??
      ticketEventSelections[campaignId] ??
      String(campaign?.eventId || '');
    const selectedCommissionPercent =
      commissionPercent ?? campaign?.commissionPercent ?? 20;
    if (status === 'live' && !selectedTicketEventId) {
      setFeedback('Select an approved ticket event before approving this poll.');
      return;
    }

    setSavingCampaignId(String(campaignId));
    try {
      const response = await fetch(`/api/voting/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          commissionPercent: selectedCommissionPercent,
          publicVoteDisplay,
          ticketEventId: selectedTicketEventId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to update campaign');
      }
      setFeedback(data.message || 'Campaign updated');
      await loadCampaigns();
    } catch (updateError) {
      setFeedback(updateError.message || 'Unable to update campaign');
    } finally {
      setSavingCampaignId('');
    }
  };

  const getContestantTicketLink = (campaign, contestant) => {
    if (!campaign.eventId) return '';
    return `/events/${encodeURIComponent(String(campaign.eventId))}?${new URLSearchParams(
      { ref: String(contestant._id) }
    ).toString()}`;
  };

  const copyContestantTicketLink = async (campaign, contestant) => {
    const path = getContestantTicketLink(campaign, contestant);
    if (!path) {
      setFeedback('This poll is not linked to a ticketing event.');
      return;
    }

    try {
      await navigator.clipboard.writeText(
        new URL(path, window.location.origin).toString()
      );
      setCopiedTicketLink(`${campaign._id}:${contestant._id}`);
      setFeedback(`Ticket link copied for ${contestant.name}.`);
    } catch {
      setFeedback(`Unable to copy the ticket link for ${contestant.name}.`);
    }
  };

  const updateNominee = (index, key, value) => {
    setForm((prev) => {
      const nominees = [...prev.nominees];
      nominees[index] = { ...nominees[index], [key]: value };
      return { ...prev, nominees };
    });
  };

  const addNomineeRow = () => {
    setForm((prev) => ({
      ...prev,
      nominees: [
        ...prev.nominees,
        { name: '', category: 'General', tagline: '', imageUrl: '' },
      ],
    }));
  };

  const uploadCampaignBanner = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setFeedback('Please select a valid banner image.');
      return;
    }

    setUploadingBanner(true);
    setFeedback('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const response = await fetch('/api/uploads/banner', {
        method: 'POST',
        body: fd,
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.bannerUrl) {
        setFeedback(data?.message || 'Unable to upload campaign banner');
        throw new Error(data?.message || 'Unable to upload campaign banner');
      }

      setForm((prev) => ({ ...prev, bannerUrl: data.bannerUrl }));
      setFeedback('Campaign banner uploaded successfully.');
    } catch {
      setFeedback('Campaign banner upload failed.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const uploadNomineeImage = async (file, index) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setFeedback('Please select a valid nominee image.');
      return;
    }

    setUploadingNomineeKey(`nominee-${index}`);
    setFeedback('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const response = await fetch('/api/uploads/contestant', {
        method: 'POST',
        body: fd,
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.imageUrl) {
        setFeedback(data?.message || 'Unable to upload nominee image');
        throw new Error(data?.message || 'Unable to upload nominee image');
      }

      updateNominee(index, 'imageUrl', data.imageUrl);
      setFeedback(`Nominee ${index + 1} image uploaded.`);
    } catch {
      setFeedback('Nominee image upload failed.');
    } finally {
      setUploadingNomineeKey('');
    }
  };

  const createCampaign = async (event) => {
    event.preventDefault();
    setCreating(true);
    setFeedback('');

    try {
      const response = await fetch(
        editingId
          ? `/api/voting/campaigns/${editingId}`
          : '/api/voting/campaigns',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedback(data.message || 'Unable to create campaign');
        return;
      }

      setFeedback(
        data.message || (editingId ? 'Poll updated' : 'Poll created')
      );
      setEditingId('');
      setFormOpen(false);
      setForm({
        title: '',
        description: '',
        category: '',
        bannerUrl: '',
        startDateTime: '',
        endDateTime: '',
        status: 'draft',
        resultVisibility: 'live',
        publicVoteDisplay: 'count',
        commissionPercent: 20,
        nominees: [
          { name: '', category: 'General', tagline: '', imageUrl: '' },
          { name: '', category: 'General', tagline: '', imageUrl: '' },
        ],
      });
      await loadCampaigns();
    } finally {
      setCreating(false);
    }
  };

  const editCampaign = (campaign) => {
    const toDateTimeLocal = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    };

    setEditingId(String(campaign._id));
    setFormOpen(true);
    setForm({
      title: campaign.title || '',
      description: campaign.description || '',
      category: campaign.category || '',
      bannerUrl: campaign.bannerUrl || '',
      startDateTime: toDateTimeLocal(campaign.startDateTime),
      endDateTime: toDateTimeLocal(campaign.endDateTime),
      status: campaign.status || 'draft',
      resultVisibility: campaign.resultVisibility || 'live',
      publicVoteDisplay: campaign.publicVoteDisplay || 'count',
      commissionPercent: campaign.commissionPercent ?? 20,
      nominees: (campaign.nominees || campaign.contestants || []).map(
        (item) => ({
          _id: String(item._id || ''),
          name: item.name || '',
          category: item.category || 'General',
          tagline: item.tagline || '',
          imageUrl: item.imageUrl || '',
        })
      ),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCreateForm = () => {
    setEditingId('');
    setFeedback('');
    setForm({
      title: '',
      description: '',
      category: '',
      bannerUrl: '',
      startDateTime: '',
      endDateTime: '',
      status: 'draft',
      resultVisibility: 'live',
      publicVoteDisplay: 'count',
      commissionPercent: 20,
      nominees: [
        { name: '', category: 'General', tagline: '', imageUrl: '' },
        { name: '', category: 'General', tagline: '', imageUrl: '' },
      ],
    });
    setFormOpen(true);
  };

  const deleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this poll and its ballots?')) return;
    const response = await fetch(`/api/voting/campaigns/${campaignId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    setFeedback(data.message || 'Unable to delete poll');
    if (response.ok && data?.success) await loadCampaigns();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Poll Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create polls, manage nominees, and control publication status from one
          panel.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Total Polls</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.totalCampaigns}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Live Polls</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.live}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Total Votes</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.totalVotes}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Ended Polls</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.ended}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Nominees</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.nominees}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Vote Activity</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.totalVotes}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Poll Analysis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A quick view of poll volume, reach, and current status.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create Poll
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            Nominee Vote Totals
          </h2>
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {nomineeTotals.length} nominees
          </span>
        </div>

        {nomineeTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No nominee votes have been recorded yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nomineeTotals.map(([name, total]) => (
              <div
                key={name}
                className="rounded-xl border border-border bg-background/40 p-3"
              >
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className="mt-1 text-2xl font-semibold text-primary">
                  {total}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  total votes
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
          <section className="w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                {editingId ? 'Edit Poll' : 'Create Poll'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <form
              className="mt-5 grid gap-4 md:grid-cols-2"
              onSubmit={createCampaign}
            >
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Campaign title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Category"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                required
              />
              <div className="md:col-span-2">
                <ImageCropUploadField
                  label="Campaign banner upload"
                  helperText="Select an image to upload. Auto-cropped to 16:9 landscape."
                  disabled={uploadingBanner}
                  aspectRatio={16 / 9}
                  onCroppedFile={uploadCampaignBanner}
                />
                {form.bannerUrl ? (
                  <div className="relative mt-3 h-40 overflow-hidden rounded-lg border border-border">
                    <Image
                      src={form.bannerUrl}
                      alt="Poll banner preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                  </div>
                ) : null}
              </div>
              <textarea
                className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="Campaign description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                required
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.startDateTime}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    startDateTime: e.target.value,
                  }))
                }
                required
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.endDateTime}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endDateTime: e.target.value }))
                }
                required
              />

              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.resultVisibility}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    resultVisibility: e.target.value,
                  }))
                }
              >
                <option value="live">Live Results</option>
                <option value="after_end">Show Results After End</option>
              </select>

              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
                type="number"
                min="0"
                max="100"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Platform commission %"
                value={form.commissionPercent}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    commissionPercent:
                      e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              />

              <div className="md:col-span-2 rounded-xl border border-border bg-background/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Nominees
                  </h3>
                  <button
                    type="button"
                    onClick={addNomineeRow}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
                  >
                    Add Nominee
                  </button>
                </div>
                <div className="space-y-3">
                  {form.nominees.map((nominee, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-4">
                      <input
                        className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder={`Nominee ${index + 1} name`}
                        value={nominee.name}
                        onChange={(e) =>
                          updateNominee(index, 'name', e.target.value)
                        }
                        required={index < 2}
                      />
                      <input
                        className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder="Category"
                        value={nominee.category || 'General'}
                        onChange={(e) =>
                          updateNominee(index, 'category', e.target.value)
                        }
                      />
                      <input
                        className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                        placeholder="Tagline"
                        value={nominee.tagline}
                        onChange={(e) =>
                          updateNominee(index, 'tagline', e.target.value)
                        }
                      />
                      <div className="rounded border border-input bg-background px-2 py-1.5 text-sm">
                        <ImageCropUploadField
                          label="Nominee image upload"
                          helperText="Select an image to upload."
                          disabled={uploadingNomineeKey === `nominee-${index}`}
                          onCroppedFile={(file) =>
                            uploadNomineeImage(file, index)
                          }
                        />
                        {nominee.imageUrl ? (
                          <div className="relative mt-2 h-20 w-20 overflow-hidden rounded-md border border-border">
                            <Image
                              src={nominee.imageUrl}
                              alt={`${nominee.name || 'Nominee'} preview`}
                              fill
                              className="object-cover"
                              sizes="80px"
                              unoptimized
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {feedback ? (
                <p className="text-sm text-primary md:col-span-2">{feedback}</p>
              ) : null}

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
              >
                {creating
                  ? 'Saving poll...'
                  : editingId
                    ? 'Save Poll'
                    : 'Create Poll'}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">Poll Queue</h2>

        {loading ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Loading campaigns...
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-3">Campaign</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Nominees</th>
                <th className="px-2 py-3">Total Votes</th>
                <th className="px-2 py-3">Nominee Totals</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((campaign) => {
                const nominees =
                  campaign.nominees || campaign.contestants || [];

                return (
                  <tr key={campaign._id} className="border-b border-border/60">
                    <td className="px-2 py-3">
                      <p className="font-medium text-foreground">
                        {campaign.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.category}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-2 py-3">{nominees.length}</td>
                    <td className="px-2 py-3">{campaign.totalVotes || 0}</td>
                    <td className="px-2 py-3">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {nominees.length === 0 ? (
                          <span>No nominees</span>
                        ) : (
                          nominees.map((nominee) => (
                            <div
                              key={nominee._id || nominee.name}
                              className="flex justify-between gap-3"
                            >
                              <span>{nominee.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {Number(nominee.voteCount || 0)}
                                </span>
                                {campaign.eventId && nominee._id ? (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={getContestantTicketLink(
                                        campaign,
                                        nominee
                                      )}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary underline underline-offset-2"
                                    >
                                      Ticket page
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyContestantTicketLink(
                                          campaign,
                                          nominee
                                        )
                                      }
                                      aria-label={`Copy ticket link for ${nominee.name}`}
                                      title="Copy contestant ticket link"
                                      className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                    {copiedTicketLink ===
                                    `${campaign._id}:${nominee._id}` ? (
                                      <span className="text-[10px] text-success">
                                        Copied
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <select
                          aria-label={`Ticket event for ${campaign.title}`}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium"
                          value={
                            ticketEventSelections[campaign._id] ||
                            String(campaign.eventId || '')
                          }
                          onChange={(event) =>
                            setTicketEventSelections((previous) => ({
                              ...previous,
                              [campaign._id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select ticket event</option>
                          {ticketEvents
                            .filter(
                              (event) =>
                                !campaign.organizerId ||
                                String(event.organizerId?._id || event.organizerId) ===
                                  String(campaign.organizerId?._id || campaign.organizerId)
                            )
                            .map((event) => (
                              <option key={event._id} value={event._id}>
                                {event.title}
                              </option>
                            ))}
                        </select>
                        {STATUS_OPTIONS.map((status) => (
                          <button
                            key={`${campaign._id}-${status}`}
                            type="button"
                            onClick={() =>
                              updateCampaignStatus(
                                campaign._id,
                                status,
                                campaign.commissionPercent ?? 20,
                                campaign.publicVoteDisplay || 'count',
                                ticketEventSelections[campaign._id] ||
                                  String(campaign.eventId || '')
                              )
                            }
                            disabled={savingCampaignId === String(campaign._id)}
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/60"
                          >
                            {status}
                          </button>
                        ))}
                        <select
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium"
                          value={campaign.publicVoteDisplay || 'count'}
                          onChange={(e) =>
                            updateCampaignStatus(
                              campaign._id,
                              campaign.status,
                              campaign.commissionPercent ?? 20,
                              e.target.value,
                              ticketEventSelections[campaign._id] ||
                                String(campaign.eventId || '')
                            )
                          }
                          disabled={savingCampaignId === String(campaign._id)}
                        >
                          <option value="count">Numerical Votes</option>
                          <option value="percent">Percentage (%)</option>
                          <option value="hide">Hide</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => editCampaign(campaign)}
                          className="rounded-md border border-primary/50 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCampaign(campaign._id)}
                          className="rounded-md border border-destructive/50 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {pollPage} of {totalPollPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pollPage === 1}
              onClick={() => setPollPage((page) => page - 1)}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pollPage === totalPollPages}
              onClick={() => setPollPage((page) => page + 1)}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
