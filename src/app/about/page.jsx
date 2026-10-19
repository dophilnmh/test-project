import {
  BadgeCheck,
  BarChart3,
  CalendarCheck2,
  Globe2,
  ShieldCheck,
  ShoppingBag,
  Vote,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

const pillars = [
  {
    title: 'Unified Event Operations',
    body: 'From creation to approval to publishing, NimblyPolls gives organizers and admins one reliable workflow.',
    icon: CalendarCheck2,
  },
  {
    title: 'Ticketing With Real Control',
    body: 'Tier-based inventory, sold-out handling, mobile checkout, and transparent order tracking in KSH.',
    icon: BadgeCheck,
  },
  {
    title: 'Digital Voting Campaigns',
    body: 'Run public voting campaigns with one-vote enforcement, live standings, and admin moderation tools.',
    icon: Vote,
  },
  {
    title: 'Merchandise Commerce',
    body: 'Launch products, manage stock, and fulfill customer orders from a built-in merchandise sales module.',
    icon: ShoppingBag,
  },
];

const trustPoints = [
  {
    label: 'Verified Workflows',
    note: 'Role-based access for admins, organizers, and members.',
    icon: ShieldCheck,
  },
  {
    label: 'Real-Time Visibility',
    note: 'Operations dashboards and analytics across events, orders, votes, and sales.',
    icon: BarChart3,
  },
  {
    label: 'Africa-Ready',
    note: 'KSH pricing, M-Pesa integrations, and deployment patterns designed for local markets.',
    icon: Globe2,
  },
];

export default function AboutPage() {
  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(30,210,201,0.14),transparent_36%),radial-gradient(circle_at_80%_0%,rgba(52,146,255,0.2),transparent_40%),linear-gradient(180deg,rgba(5,11,35,1)_0%,rgba(9,20,55,1)_100%)]" />

        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <p className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            About NimblyPolls
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight text-foreground md:text-6xl">
            One Platform For Ticketing, Voting, Merchandise, And Event Growth.
          </h1>
          <p className="mt-6 max-w-3xl text-base text-muted-foreground md:text-lg">
            NimblyPolls helps communities, brands, and organizers run modern
            event ecosystems with confidence. We combine secure operations,
            public discovery, payments, campaign tools, and analytics in one
            platform that is built for real-world execution.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            What We Built
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            NimblyPolls is structured as a modular operations system, so every
            capability works independently and together.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-2xl border border-border bg-card/85 p-5 shadow-[0_10px_24px_-20px_rgba(59,130,246,.8)]"
            >
              <pillar.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-xl font-semibold text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pillar.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="rounded-2xl border border-border bg-card/80 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Why Teams Trust NimblyPolls
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {trustPoints.map((point) => (
              <article
                key={point.label}
                className="rounded-xl border border-border bg-background/50 p-4"
              >
                <point.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {point.label}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {point.note}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            Mission: empower organizers and communities to run high-quality
            digital event experiences with clarity, control, and scale.
          </div>
        </div>
      </section>
    </Layout>
  );
}
