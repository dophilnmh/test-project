'use client';

import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';

const sections = [
  {
    title: 'Using the platform',
    body: 'You agree to use NimblyPolls for lawful ticketing, voting, and organizer operations only. You are responsible for the accuracy of the information you submit.',
  },
  {
    title: 'Payments and refunds',
    body: 'Payments are processed through supported payment providers. Refunds, where applicable, depend on the event or campaign rules published by the organizer and platform policy.',
  },
  {
    title: 'Organizer content',
    body: 'Organizers are responsible for the accuracy of event details, banners, ticket tiers, vote packages, and withdrawal requests submitted through the platform.',
  },
  {
    title: 'Acceptable conduct',
    body: 'You may not abuse the platform, interfere with payment systems, post misleading content, or attempt unauthorized access to accounts or data.',
  },
];

export default function TermsPage() {
  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Legal
          </p>
          <h1 className="mt-2 text-4xl font-bold text-foreground md:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            These terms explain how NimblyPolls should be used by visitors,
            organizers, and admin users.
          </p>
        </div>

        <div className="mt-10 grid gap-4">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-border bg-card/80 p-5"
            >
              <h2 className="text-lg font-semibold text-foreground">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {section.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">
            If you have questions about these terms, please contact the team via
            the{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact page
            </Link>
            .
          </p>
        </div>
      </section>
    </Layout>
  );
}
