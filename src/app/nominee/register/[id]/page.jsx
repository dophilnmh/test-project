'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ImageCropUploadField } from '@/components/ui/ImageCropUploadField';

export default function NomineeRegistrationPage() {
  const { id } = useParams();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    category: '',
    profileImageUrl: '',
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(`/api/events/competitions/${id}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (response.ok && data?.success) {
          setCategories(data.competition?.categories || []);
        }
      } catch {
        setCategories([]);
      }
    };
    if (id) loadCategories();
  }, [id]);

  const uploadPhoto = async (file) => {
    setError('');
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/uploads/nominee-photo', {
        method: 'POST',
        body,
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to upload photo. Please try again.');
        return false;
      }

      setForm((prev) => ({ ...prev, profileImageUrl: data.imageUrl }));
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
    setFeedback('');
    setError('');

    if (!form.profileImageUrl) {
      setError('Please upload and crop your photo before submitting.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/events/competitions/${id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to register contestant.');
        return;
      }

      setFeedback(data.message || 'Contestant registered successfully.');
      setForm({ fullName: '', category: '', profileImageUrl: '' });
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <section className="container mx-auto max-w-2xl px-4 py-14 md:py-20">
        <div className="rounded-2xl border border-border bg-card/85 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Contestant Registration
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">
            Register for this event
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit your contestant details directly to the event linked in your
            invitation.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold text-foreground">
              Full name
              <input
                required
                minLength={2}
                value={form.fullName}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    fullName: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Category
              <select
                required
                value={form.category}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    category: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal"
              >
                <option value="" disabled>
                  Select Category
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <ImageCropUploadField
                label="Upload your photo"
                helperText={
                  uploadingPhoto
                    ? 'Uploading photo...'
                    : 'Select a photo, position and crop it, then use it.'
                }
                disabled={uploadingPhoto || submitting}
                onCroppedFile={uploadPhoto}
              />
              {form.profileImageUrl ? (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.profileImageUrl}
                    alt="Contestant photo preview"
                    className="h-16 w-16 rounded-full border-2 border-primary object-cover"
                  />
                  <span className="text-xs text-success">
                    Photo uploaded and ready.
                  </span>
                </div>
              ) : null}
            </div>

            {feedback ? (
              <p className="text-sm text-success">{feedback}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || uploadingPhoto || !form.profileImageUrl}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitting ? 'Registering...' : 'Register contestant'}
            </button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
