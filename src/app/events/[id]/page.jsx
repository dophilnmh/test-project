'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import { Layout } from '@/components/layout/Layout';
import { useParams, useSearchParams } from 'next/navigation';
import { formatKsh } from '@/lib/currency';

const formatTicketName = (name) =>
  (() => {
    const title = String(name || '')
    .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
    return /\sTicket$/i.test(title) ? title : `${title} Ticket`;
  })();

export default function EventTicketPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketQuantities, setTicketQuantities] = useState({});

  const loadEvent = useCallback(async (initializeQuantities = false) => {
    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(String(id || ''))}`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      if (response.ok && data?.success) {
        setEvent(data.event);
        if (initializeQuantities) {
          const requestedTier = searchParams.get('tier');
          const availableTier = (data.event?.tiers || []).find(
            (item) => item.name === requestedTier
          );
          const requestedQuantity = Number(searchParams.get('quantity'));
          const initialQuantities = {};
          for (const tier of data.event?.tiers || []) {
            const tierQuantity =
              tier.name === availableTier?.name &&
              Number.isFinite(requestedQuantity) &&
              requestedQuantity > 0
                ? Math.round(requestedQuantity)
                : 1;
            initialQuantities[tier.name] = Math.min(
              Math.max(1, Number(tier.remainingSlots || 0)),
              Math.max(1, tierQuantity)
            );
          }
          setTicketQuantities(initialQuantities);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, searchParams]);

  useEffect(() => {
    if (!id) return;
    loadEvent(true);
    const availabilityTimer = setInterval(() => loadEvent(), 5000);
    return () => clearInterval(availabilityTimer);
  }, [id, loadEvent]);

  return (
    <Layout>
      <main className="container mx-auto px-4 py-14 md:py-20">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading event tickets...
          </p>
        ) : null}
        {!loading && event ? (
          <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card/85">
            <div className="relative h-56 w-full bg-background md:h-80">
              <Image
                src={event.bannerUrl || '/images/event-placeholder.png'}
                alt={event.title}
                fill
                className="object-cover"
                sizes="100vw"
              />
            </div>
            <div className="p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Ticketing Event
              </p>
              <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
                {event.title}
              </h1>
              <p className="mt-3 text-muted-foreground">{event.description}</p>
              <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <span>
                  <CalendarDays className="mr-2 inline h-4 w-4 text-primary" />
                  {new Date(
                    event.startDateTime || event.date
                  ).toLocaleDateString()}
                </span>
                <span>
                  <Clock3 className="mr-2 inline h-4 w-4 text-primary" />
                  {event.startTime || 'Time TBA'}
                </span>
                <span>
                  <MapPin className="mr-2 inline h-4 w-4 text-primary" />
                  {event.venue}
                </span>
              </div>
              <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-foreground">
                  Available Tickets
                </h2>
                {(event.tiers || []).map((ticketTier) => {
                  const soldOut = Number(ticketTier.remainingSlots || 0) <= 0;
                  const maxQuantity = Math.max(
                    1,
                    Number(ticketTier.remainingSlots || 0)
                  );
                  const selectedQuantity = Math.min(
                    maxQuantity,
                    Math.max(1, Number(ticketQuantities[ticketTier.name] || 1))
                  );
                  const ticketName = formatTicketName(ticketTier.name);

                  return (
                    <div
                      key={ticketTier.name}
                      className={`rounded-lg border p-4 shadow-[0_0_14px_rgba(44,229,216,0.18)] ${
                        soldOut
                          ? 'border-neutral-500 bg-neutral-800 text-neutral-300 shadow-none'
                          : 'border-[#2CE5D8] bg-[#0A0E27] text-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{ticketName}</h3>
                          <p className="mt-1 whitespace-pre-line text-sm opacity-75">
                            {ticketTier.description ||
                              'No additional privileges listed.'}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold">
                          {formatKsh(ticketTier.price)}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-md border border-current/30">
                          <button
                            type="button"
                            aria-label={`Decrease ${ticketName} quantity`}
                            disabled={soldOut || selectedQuantity <= 1}
                            onClick={() =>
                              setTicketQuantities((previous) => ({
                                ...previous,
                                [ticketTier.name]: selectedQuantity - 1,
                              }))
                            }
                            className="px-3 py-1.5 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            -
                          </button>
                          <span
                            aria-live="polite"
                            className="min-w-8 text-center text-sm font-semibold"
                          >
                            {selectedQuantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase ${ticketName} quantity`}
                            disabled={
                              soldOut || selectedQuantity >= maxQuantity
                            }
                            onClick={() =>
                              setTicketQuantities((previous) => ({
                                ...previous,
                                [ticketTier.name]: selectedQuantity + 1,
                              }))
                            }
                            className="px-3 py-1.5 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        {soldOut ? (
                          <span className="text-xs font-bold tracking-wide">
                            SOLD OUT
                          </span>
                        ) : (
                          <MpesaCheckoutButton
                            eventId={event._id}
                            eventTitle={event.title}
                            amount={ticketTier.price}
                            tierName={ticketTier.name}
                            quantity={selectedQuantity}
                            maxQuantity={ticketTier.remainingSlots}
                            referrerId={searchParams.get('ref') || ''}
                            onPaymentSuccess={() => loadEvent()}
                            buttonLabel="Purchase"
                            className="inline-flex items-center rounded-md bg-[#2CE5D8] px-3 py-2 text-sm font-bold text-[#0A0E27] transition hover:bg-[#9af5ee]"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          </article>
        ) : !loading ? (
          <p className="text-sm text-muted-foreground">Event not found.</p>
        ) : null}
      </main>
    </Layout>
  );
}
