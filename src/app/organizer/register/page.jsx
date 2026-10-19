'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import countiesData from '@/lib/counties.json';

export default function OrganizerRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    organizationName: '',
    contactName: '',
    email: '',
    phone: '',
    county: '',
    subCounty: '',
    website: '',
    description: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFeedback('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/organizer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: form.organizationName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          county: form.county,
          subCounty: form.subCounty,
          website: form.website,
          description: form.description,
          password: form.password,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to create organizer account');
        return;
      }

      setFeedback(data.message || 'Organizer account created successfully');
      setForm({
        organizationName: '',
        contactName: '',
        email: '',
        phone: '',
        county: '',
        subCounty: '',
        website: '',
        description: '',
        password: '',
        confirmPassword: '',
      });
      setTimeout(() => {
        router.push('/login?next=/organizer');
      }, 1500);
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-linear-to-br from-card/95 via-card/90 to-background/80 p-6 shadow-sm md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Organizer Onboarding
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Create Organizer Account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Register your organization to publish events after admin approval.
          Contact details entered here are used for account notifications.
        </p>
      </header>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <input
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Organizer name"
          value={form.organizationName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, organizationName: e.target.value }))
          }
          required
        />
        <input
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Contact person (on behalf of organizer)"
          value={form.contactName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, contactName: e.target.value }))
          }
          required
        />
        <input
          type="email"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Business email"
          value={form.email}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, email: e.target.value }))
          }
          required
        />
        <input
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, phone: e.target.value }))
          }
          required
        />
        <select
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={form.county}
          onChange={(e) => {
            const county = e.target.value;
            setForm((prev) => ({ ...prev, county, subCounty: '' }));
          }}
          required
        >
          <option value="">Business county</option>
          {countiesData.map((county) => (
            <option key={county.county_code} value={county.county_name}>
              {county.county_name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={form.subCounty}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, subCounty: e.target.value }))
          }
          disabled={!form.county}
          required
        >
          <option value="">Business subcounty</option>
          {(
            countiesData.find((county) => county.county_name === form.county)
              ?.sub_counties || []
          ).map((subCounty) => (
            <option
              key={subCounty.sub_counties_name}
              value={subCounty.sub_counties_name}
            >
              {subCounty.sub_counties_name}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Website or social link (optional)"
          value={form.website}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, website: e.target.value }))
          }
        />
        <input
          type={showPassword ? 'text' : 'password'}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Password (min 8 chars recommended)"
          value={form.password}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, password: e.target.value }))
          }
          required
        />
        <div className="space-y-2">
          <input
            type={showPassword ? 'text' : 'password'}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
            }
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showPassword ? 'Hide passwords' : 'Show passwords'}
          </button>
        </div>
        <textarea
          className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          placeholder="Describe the events you host (concerts, summits, festivals...)"
          value={form.description}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
        />
        {error ? (
          <p className="text-sm text-destructive md:col-span-2">{error}</p>
        ) : null}
        {feedback ? (
          <p className="text-sm text-success md:col-span-2">{feedback}</p>
        ) : null}
        <button
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 md:col-span-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login?next=/organizer"
          className="text-primary hover:underline"
        >
          Login here
        </Link>
      </p>
    </section>
  );
}
