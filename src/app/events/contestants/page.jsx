import { notFound, redirect } from 'next/navigation';
import connect from '@/app/utils/db';
import Event from '@/app/models/Event';
import VotingCampaign from '@/app/models/VotingCampaign';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import { formatKsh } from '@/lib/currency';
import { parseCompetitionTicketReferral } from '@/lib/ticketReferral';
import { Layout } from '@/components/layout/Layout';

function getTicketingFilter() {
  return {
    status: 'approved',
    $or: [{ eventType: 'ticketing' }, { eventType: { $exists: false } }],
  };
}

async function getPollTicketDetails(params) {
  const { campaignId, contestantId, eventId } = params;
  if (
    !/^[a-f\d]{24}$/i.test(campaignId) ||
    !/^[a-f\d]{24}$/i.test(contestantId) ||
    !/^[a-f\d]{24}$/i.test(eventId)
  ) {
    return null;
  }

  const [campaign, event] = await Promise.all([
    VotingCampaign.findOne({ _id: campaignId, eventId })
      .select('title eventId contestants nominees')
      .lean(),
    Event.findOne({ _id: eventId, ...getTicketingFilter() }).lean(),
  ]);
  if (!campaign || !event) return null;

  const contestants = campaign.contestants?.length
    ? campaign.contestants
    : campaign.nominees || [];
  const contestant = contestants.find(
    (item) => String(item._id) === contestantId
  );
  if (!contestant) return null;

  return {
    contestantName: String(contestant.name || '').trim(),
    contestantCategory: String(contestant.category || 'General').trim(),
    sourceTitle: campaign.title,
    referralId: contestantId,
    events: [event],
  };
}

async function getCompetitionTicketDetails(referralToken) {
  const referral = parseCompetitionTicketReferral(referralToken);
  if (!referral) return null;

  const sourceEvent = await Event.findOne({
    _id: referral.eventId,
    status: 'approved',
    eventType: 'competition',
  })
    .select(
      'title organizerId competition.ticketEventId competition.contestants'
    )
    .lean();
  if (!sourceEvent) return null;

  const contestant = (sourceEvent.competition?.contestants || []).find(
    (item) =>
      String(item.fullName || '').trim().toLowerCase() ===
        referral.fullName.toLowerCase() &&
      String(item.category || '').trim().toLowerCase() ===
        referral.category.toLowerCase()
  );
  if (!contestant) return null;

  if (!sourceEvent.competition?.ticketEventId) return null;
  const event = await Event.findOne({
    _id: sourceEvent.competition.ticketEventId,
    ...getTicketingFilter(),
    organizerId: sourceEvent.organizerId,
  }).lean();
  if (!event) return null;

  return {
    contestantName: String(contestant.fullName || '').trim(),
    contestantCategory: String(contestant.category || '').trim(),
    sourceTitle: sourceEvent.title,
    referralId: referralToken,
    events: [event],
  };
}

export default async function ContestantTicketPage({ searchParams }) {
  const params = await searchParams;
  await connect();

  const details =
    params.type === 'poll'
      ? await getPollTicketDetails({
          campaignId: String(params.campaignId || ''),
          contestantId: String(params.contestantId || ''),
          eventId: String(params.eventId || ''),
        })
      : params.type === 'competition'
        ? await getCompetitionTicketDetails(String(params.ref || ''))
        : null;

  if (!details) notFound();
  if (details.events.length === 1) {
    redirect(
      `/events/${encodeURIComponent(String(details.events[0]._id))}?${new URLSearchParams(
        { ref: details.referralId }
      ).toString()}`
    );
  }

  const eventsWithTickets = details.events
    .map((event) => ({
      ...event,
      tiers: (event.tiers || []).filter((tier) => tier.isActive !== false),
    }))
    .filter((event) => event.tiers.length > 0);

  return (
    <Layout>
      <main className="container mx-auto max-w-5xl px-4 py-14 md:py-20">
        <header className="mb-8 rounded-2xl border border-primary/30 bg-card/85 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Contestant ticket page
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
            Tickets supporting {details.contestantName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {details.contestantCategory} · {details.sourceTitle}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Ticket purchases from this page are attributed to this contestant.
          </p>
        </header>

        {eventsWithTickets.length ? (
          <div className="space-y-5">
            {eventsWithTickets.map((event) => (
              <article
                key={String(event._id)}
                className="rounded-2xl border border-border bg-card/85 p-5 md:p-6"
              >
                <h2 className="text-xl font-semibold text-foreground">
                  {event.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.venue}
                  {event.city ? ` · ${event.city}` : ''}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {event.tiers.map((tier) => (
                    <div
                      key={`${event._id}-${tier.name}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/50 p-4"
                    >
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {tier.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatKsh(tier.price)} ·{' '}
                          {Math.max(0, Number(tier.remainingSlots || 0))}{' '}
                          available
                        </p>
                      </div>
                      {Number(tier.remainingSlots || 0) > 0 ? (
                        <MpesaCheckoutButton
                          eventId={String(event._id)}
                          eventTitle={event.title}
                          amount={Number(tier.price || 0)}
                          tierName={tier.name}
                          maxQuantity={tier.remainingSlots}
                          referrerId={details.referralId}
                          buttonLabel="Buy Ticket"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                          Sold out
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
            No approved ticket events are currently available for this
            contestant.
          </div>
        )}
      </main>
    </Layout>
  );
}
