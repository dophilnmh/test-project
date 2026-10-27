'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Layout } from '@/components/layout/Layout';
import { ImageCropUploadField } from '@/components/ui/ImageCropUploadField';

export default function PollContestantRegistrationPage() {
  const params = useParams();
  const campaignId = String(params?.id || '');
  const [campaign, setCampaign] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPoll = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/voting/campaigns/${encodeURIComponent(campaignId)}/register`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        if (!response.ok || !data?.success) {
          setError(
            data?.message || 'This poll registration link is unavailable.'
          );
          setCampaign(null);
          return;
        }
        setCampaign(data.campaign);
        setCategory((previous) =>
          data.campaign.categories.includes(previous)
            ? previous
            : data.campaign.categories[0] || ''
        );
      } catch {
        setError('Unable to load this poll registration link.');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) loadPoll();
  }, [campaignId]);

  const uploadPhoto = async (file) => {
    setUploadingPhoto(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/uploads/nominee-photo', {
        method: 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.imageUrl) {
        setError(data?.message || 'Unable to upload photo.');
        return false;
      }
      setImageUrl(data.imageUrl);
      return true;
    } catch {
      setError('Photo upload failed. Please try again.');
      return false;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    if (!imageUrl) {
      setError('Please upload your photo before submitting.');
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/voting/campaigns/${encodeURIComponent(campaignId)}/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, category, imageUrl }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to submit registration.');
        return;
      }
      setMessage(data.message || 'Registration submitted.');
      setName('');
      setImageUrl('');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <main className="container mx-auto max-w-xl px-4 py-14 md:py-20">
        <section className="rounded-xl border border-border bg-card/85 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Poll contestant registration
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {campaign?.title || 'Register for a poll'}
          </h1>
          {campaign?.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {campaign.description}
            </p>
          ) : null}

          {loading ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Loading registration form...
            </p>
          ) : null}

          {!loading && campaign ? (
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block text-sm font-semibold text-foreground">
                Name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Category
                <select
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal"
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {campaign.categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <ImageCropUploadField
                  label="Upload photo"
                  helperText={
                    uploadingPhoto
                      ? 'Uploading photo...'
                      : 'Choose and position a clear photo before submitting.'
                  }
                  disabled={uploadingPhoto || submitting}
                  onCroppedFile={uploadPhoto}
                />
                {imageUrl ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Image
                      src={imageUrl}
                      alt="Registration photo preview"
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-full border-2 border-primary object-cover"
                    />
                    <span className="text-xs text-success">
                      Photo uploaded and ready.
                    </span>
                  </div>
                ) : null}
              </div>

              {campaign.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This poll has no categories available for registration.
                </p>
              ) : null}
              {message ? (
                <p role="status" className="text-sm text-success">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  submitting ||
                  uploadingPhoto ||
                  campaign.categories.length === 0 ||
                  !imageUrl
                }
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit registration'}
              </button>
            </form>
          ) : null}

          {!loading && !campaign && error ? (
            <p role="alert" className="mt-5 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    </Layout>
  );
}
