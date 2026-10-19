'use client';

import Image from 'next/image';
import { useState } from 'react';
import { CalendarClock, MapPin, UserRound, X } from 'lucide-react';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EventDetailsModal({
  event,
  open,
  onClose,
  showActions = false,
  onApprove,
  onReject,
  actionEventId,
  commissionTerms,
  onCommissionChange,
  canEditTicketTiers = false,
  onSaveTicketTiers,
  savingTicketTiers = false,
  ticketTierError = '',
}) {
  const [ticketDrafts, setTicketDrafts] = useState(() =>
    (event?.tiers || []).map((tier) => ({
      name: String(tier.name || ''),
      price: Number(tier.price || 0),
      description: String(tier.description || ''),
      isActive: tier.isActive !== false,
      totalSlots: Number(tier.totalSlots || 0),
      sold: Math.max(
        0,
        Number(tier.totalSlots || 0) - Number(tier.remainingSlots || 0)
      ),
    }))
  );

  if (!open || !event) return null;

  const displayedCommissionTerms =
    commissionTerms || event.commercialTerms || {};
  const invalidTicketDrafts = ticketDrafts.some(
    (tier) =>
      Number(tier.totalSlots) < tier.sold ||
      tier.description.trim().split(/\s+/).filter(Boolean).length > 1000
  );

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              {event.title}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {event.category || 'General'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-border px-2 py-2 text-muted-foreground hover:text-foreground"
            aria-label="Close event details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {event.bannerUrl ? (
          <div className="relative mt-4 h-56 overflow-hidden rounded-lg border border-border">
            <Image
              src={event.bannerUrl}
              alt={`${event.title} banner`}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              {event.organizerId?.organizationName ||
                event.organizerName ||
                '-'}
            </p>
            <p className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {event.venue} • {event.city}
            </p>
            <p className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Submitted {formatDate(event.createdAt)}
            </p>
            <p className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Starts {formatDate(event.startDateTime)}
            </p>
            <p className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Ends {formatDate(event.endDateTime)}
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">
                Organizer Contact:
              </span>{' '}
              {event.organizerId?.contactName || '-'}
            </p>
            <p>
              <span className="font-semibold text-foreground">Email:</span>{' '}
              {event.organizerId?.email || '-'}
            </p>
            <p>
              <span className="font-semibold text-foreground">Phone:</span>{' '}
              {event.organizerId?.phone || '-'}
            </p>
            <p>
              <span className="font-semibold text-foreground">Location:</span>{' '}
              {event.organizerId?.county || '-'} /{' '}
              {event.organizerId?.subCounty || '-'}
            </p>
            <p>
              <span className="font-semibold text-foreground">
                Submitted By:
              </span>{' '}
              {event.submittedByName || '-'} ({event.submittedByEmail || '-'})
            </p>
            <p>
              <span className="font-semibold text-foreground">
                Submitter Role:
              </span>{' '}
              {event.submittedByRole || '-'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/70 bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Event Description
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-border/70 bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ticket Tiers
          </p>
          {Array.isArray(event.tiers) && event.tiers.length > 0 ? (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {(canEditTicketTiers ? ticketDrafts : event.tiers).map(
                (tier, index) => (
                  <div
                    key={`${event._id}-${tier.name}`}
                    className="rounded-md border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground"
                  >
                    <p className="font-semibold text-foreground">{tier.name}</p>
                    {canEditTicketTiers ? (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label>
                            Price (KSH)
                            <input
                              type="number"
                              min="0"
                              value={tier.price}
                              onChange={(inputEvent) =>
                                setTicketDrafts((previous) =>
                                  previous.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          price: inputEvent.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                          </label>
                          <label>
                            Total capacity
                            <input
                              type="number"
                              min={tier.sold}
                              value={tier.totalSlots}
                              onChange={(inputEvent) =>
                                setTicketDrafts((previous) =>
                                  previous.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          totalSlots: inputEvent.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                            <span className="mt-1 block text-muted-foreground">
                              {tier.sold.toLocaleString()} sold
                            </span>
                          </label>
                        </div>
                        <label className="block">
                          Ticket privileges
                          <textarea
                            rows={3}
                            maxLength={20000}
                            value={tier.description}
                            onChange={(inputEvent) =>
                              setTicketDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        description: inputEvent.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            className="mt-1 w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                          <span className="mt-1 block text-right text-muted-foreground">
                            {
                              tier.description
                                .trim()
                                .split(/\s+/)
                                .filter(Boolean).length
                            }{' '}
                            / 1000 words
                          </span>
                        </label>
                        <label className="inline-flex items-center gap-2 font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={tier.isActive}
                            onChange={(inputEvent) =>
                              setTicketDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        isActive: inputEvent.target.checked,
                                      }
                                    : item
                                )
                              )
                            }
                          />
                          Available for purchase
                        </label>
                      </div>
                    ) : (
                      <>
                        <p>
                          Price: KSH {Number(tier.price || 0).toLocaleString()}
                        </p>
                        <p>
                          Slots: {Number(tier.totalSlots || 0).toLocaleString()}
                        </p>
                        <p>
                          Remaining:{' '}
                          {Number(tier.remainingSlots || 0).toLocaleString()}
                        </p>
                        <p className="mt-1 whitespace-pre-line">
                          {tier.description || 'No privileges listed.'}
                        </p>
                        {tier.isActive === false ? (
                          <p className="mt-1 font-semibold text-destructive">
                            Disabled
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No tiers configured.
            </p>
          )}
          {canEditTicketTiers ? (
            <>
              {ticketTierError ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {ticketTierError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => onSaveTicketTiers?.(event._id, ticketDrafts)}
                disabled={
                  savingTicketTiers ||
                  ticketDrafts.length === 0 ||
                  invalidTicketDrafts
                }
                className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTicketTiers ? 'Saving tiers...' : 'Save ticket changes'}
              </button>
            </>
          ) : null}
        </div>

        {showActions || event.commercialTerms ? (
          <div className="mt-5 space-y-3">
            <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-3">
              {[
                ['ticketCommissionPercent', 'Ticket'],
                ['merchandiseCommissionPercent', 'Merchandise'],
                ['votingCommissionPercent', 'Voting'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="text-xs font-semibold text-foreground"
                >
                  {label} Platform Commission (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={displayedCommissionTerms[key] ?? ''}
                    onChange={(e) => onCommissionChange?.(key, e.target.value)}
                    readOnly={!showActions}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-normal"
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onApprove?.(event._id)}
                disabled={actionEventId === event._id}
                className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-success disabled:cursor-not-allowed disabled:opacity-60"
              >
                Approve & Go Live
              </button>
              <button
                onClick={() => onReject?.(event._id)}
                disabled={actionEventId === event._id}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
