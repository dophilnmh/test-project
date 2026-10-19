'use client';

import { useState } from 'react';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function ContactPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to send message');
        return;
      }

      setFeedback(data.message || 'Message sent successfully');
      setForm({
        fullName: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Contact NimblyPolls
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
            Let’s Plan Your Next Big Experience
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Reach out for ticketing setup, voting campaigns, merchandise
            operations, sponsorships, and platform support.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-border bg-card/85 p-6">
            <h2 className="text-xl font-semibold text-foreground">
              Send a Message
            </h2>

            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                required
              />
              <input
                type="email"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Subject"
                value={form.subject}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                required
              />
              <textarea
                className="min-h-32 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="How can we help you?"
                value={form.message}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, message: e.target.value }))
                }
                required
              />

              {error ? (
                <p className="text-sm text-destructive md:col-span-2">
                  {error}
                </p>
              ) : null}
              {feedback ? (
                <p className="text-sm text-success md:col-span-2">{feedback}</p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <article className="rounded-2xl border border-border bg-card/85 p-5">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                Email
              </h3>
              <a
                href="mailto:Info@nimblypolls.com"
                className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary"
              >
                Info@nimblypolls.com
              </a>
            </article>

            <article className="rounded-2xl border border-border bg-card/85 p-5">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                Phone
              </h3>
              <a
                href="tel:+254759673053"
                className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary"
              >
                0759 673 053
              </a>
            </article>

            <article className="rounded-2xl border border-border bg-card/85 p-5">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                WhatsApp
              </h3>
              <a
                href="https://wa.me/254759673053"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary"
              >
                0759 673 053
              </a>
            </article>

            <article className="rounded-2xl border border-border bg-card/85 p-5">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                Office Locations
              </h3>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>West End Towers, Waiyaki Way, Nairobi</li>
                <li>Mega Plaza, Oginga Odinga Street, Kisumu</li>
              </ul>
            </article>
          </section>
        </div>
      </section>
    </Layout>
  );
}
