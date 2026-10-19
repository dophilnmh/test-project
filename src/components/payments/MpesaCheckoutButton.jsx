'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, Smartphone, X } from 'lucide-react';
import { formatKsh } from '@/lib/currency';

const TICKET_MODAL_PRESETS = [1, 2, 3, 5];
const VOTE_MODAL_PRESETS = [1, 5, 10, 30];

export function MpesaCheckoutButton({
  eventId,
  eventTitle,
  amount,
  tierName = 'regular',
  quantity = 1,
  maxQuantity,
  maxVoteQuantity,
  paymentType = 'ticket',
  contestantId = '',
  packageId = '',
  packageName = '',
  productId = '',
  deliveryLocation = '',
  notes = '',
  referrerId = '',
  requestedVotes,
  customerEmail = '',
  onPaymentSuccess,
  className,
  buttonLabel,
}) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(
    paymentType === 'merchandise' || paymentType === 'merch' ? 'card' : 'mpesa'
  );
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(customerEmail || '');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [statusNote, setStatusNote] = useState('');
  const [modalQuantity, setModalQuantity] = useState(
    Math.max(1, Math.round(Number(quantity || 1)))
  );
  const pollRef = useRef(null);
  const closeTimerRef = useRef(null);
  const normalizedPaymentType =
    paymentType === 'campaign_vote' || paymentType === 'voting'
      ? 'vote'
      : paymentType;
  const isTicketPurchase = normalizedPaymentType === 'ticket';
  const isMerchPurchase =
    normalizedPaymentType === 'merchandise' ||
    normalizedPaymentType === 'merch';
  const isVotePurchase =
    normalizedPaymentType === 'vote' ||
    normalizedPaymentType === 'competition_vote';
  const safeMaxVoteQuantity = Number.isFinite(Number(maxVoteQuantity))
    ? Math.max(1, Math.round(Number(maxVoteQuantity)))
    : null;
  const baseVoteCount = Math.max(
    1,
    Math.round(Number(requestedVotes || quantity || 1))
  );
  const voteUnitAmount = Math.max(0, Number(amount || 0)) / baseVoteCount;
  const effectiveVoteCount = isVotePurchase
    ? safeMaxVoteQuantity
      ? Math.min(
          safeMaxVoteQuantity,
          Math.max(1, Math.round(Number(modalQuantity || baseVoteCount)))
        )
      : Math.max(1, Math.round(Number(modalQuantity || baseVoteCount)))
    : baseVoteCount;
  const safeMaxQuantity = Number.isFinite(Number(maxQuantity))
    ? Math.max(1, Math.round(Number(maxQuantity)))
    : null;
  const effectiveQuantity =
    isTicketPurchase || isMerchPurchase
      ? safeMaxQuantity
        ? Math.min(
            safeMaxQuantity,
            Math.max(1, Math.round(Number(modalQuantity || 1)))
          )
        : Math.max(1, Math.round(Number(modalQuantity || 1)))
      : Math.max(1, Math.round(Number(quantity || 1)));
  const payableAmount =
    isTicketPurchase || isMerchPurchase
      ? Math.max(0, Number(amount || 0)) * effectiveQuantity
      : isVotePurchase
        ? Math.max(1, Math.round(voteUnitAmount * effectiveVoteCount))
        : Math.max(0, Number(amount || 0));
  const ctaLabel =
    buttonLabel ||
    (normalizedPaymentType === 'vote' ||
    normalizedPaymentType === 'competition_vote'
      ? 'Vote Now'
      : 'Purchase Ticket');
  const processingMessage =
    normalizedPaymentType === 'vote' ||
    normalizedPaymentType === 'competition_vote'
      ? 'STK request sent. Enter your M-Pesa PIN on your phone to confirm your votes. This can take up to 2 minutes.'
      : 'STK request sent. Enter your M-Pesa PIN on your phone to confirm your ticket purchase. This can take up to 2 minutes.';
  const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const stopCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const readJsonSafely = async (response) => {
    try {
      return await response.json();
    } catch {
      const text = await response.text();
      return text ? { message: text } : null;
    }
  };

  const fetchStatus = async (requestId) => {
    try {
      const response = await fetch(
        `/api/payments/mpesa/status/${encodeURIComponent(requestId)}`,
        {
          cache: 'no-store',
        }
      );

      const data = await readJsonSafely(response);
      if (!response.ok || !data?.success || !data?.data) return;

      const status = data.data.status || 'pending';
      setPaymentStatus(status);
      setStatusNote(data.data.resultDesc || 'Status updated');

      if (status === 'paid') {
        const successMessage =
          normalizedPaymentType === 'vote' ||
          normalizedPaymentType === 'competition_vote'
            ? 'Payment received successfully. Votes confirmed.'
            : data?.data?.ticketGenerated
              ? `Payment received successfully. Ticket confirmed and generated. Ticket code: ${data?.data?.ticketCode || '-'}.`
              : 'Payment received successfully. Ticket confirmed. Generating ticket details...';
        setFeedback(successMessage);
        if (typeof onPaymentSuccess === 'function') {
          onPaymentSuccess(data.data);
        }
        stopPolling();
        setOpen(true);
      } else if (status === 'failed') {
        setError(data.data.resultDesc || 'Payment was not completed.');
        stopPolling();
      }
    } catch {
      setError('Unable to check payment status right now.');
      stopPolling();
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      stopCloseTimer();
    };
  }, []);

  useEffect(() => {
    if (open) {
      setModalQuantity(
        Math.max(1, Math.round(Number(requestedVotes || quantity || 1)))
      );
    }
  }, [open, quantity, requestedVotes]);

  useEffect(() => {
    if (customerEmail) setEmail(customerEmail);
  }, [customerEmail]);

  useEffect(() => {
    if (!open || paymentStatus !== 'paid') return;

    stopCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      stopCloseTimer();
    }, 1800);

    return () => stopCloseTimer();
  }, [open, paymentStatus]);

  const initiateCheckout = async (e) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    setPaymentStatus('idle');
    setStatusNote('');
    setCheckoutRequestId('');
    stopPolling();

    if (isTicketPurchase && !String(email || '').trim()) {
      setError(
        'Email is required before buying a ticket. We send your ticket and QR code to this email.'
      );
      setLoading(false);
      return;
    }

    if (isTicketPurchase && !isValidEmail(email)) {
      setError(
        'Please enter a valid email address to receive your ticket details.'
      );
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/payments/mpesa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentType: normalizedPaymentType,
          eventId,
          campaignId: eventId,
          eventTitle,
          amount: payableAmount,
          tierName,
          quantity: isTicketPurchase ? effectiveQuantity : 1,
          requestedVotes: isVotePurchase
            ? effectiveVoteCount
            : Math.max(1, Math.round(Number(requestedVotes || 0))),
          phone,
          email,
          contestantId,
          contestantKey: contestantId,
          packageId,
          packageName,
          referrerId: isTicketPurchase ? referrerId : '',
        }),
      });

      const data = await readJsonSafely(response);

      if (!response.ok || !data.success) {
        setError(
          data?.message ||
            data?.details?.errorMessage ||
            'Failed to start M-Pesa checkout'
        );
        return;
      }

      setCheckoutRequestId(data.checkoutRequestId || '');
      setPaymentStatus('pending');
      setStatusNote(processingMessage);
      setFeedback(
        data.customerMessage || 'M-Pesa prompt sent. Check your phone.'
      );

      if (data.checkoutRequestId) {
        await fetchStatus(data.checkoutRequestId);

        if (!data.mock) {
          pollRef.current = setInterval(() => {
            fetchStatus(data.checkoutRequestId);
          }, 3000);

          setTimeout(() => {
            stopPolling();
          }, 120000);
        }
      }
    } catch {
      setError(
        'Unable to reach the M-Pesa checkout service. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const initiateCardCheckout = async (e) => {
    e.preventDefault();
    setError('');
    setFeedback('');

    if (!isTicketPurchase && !isVotePurchase && !isMerchPurchase) return;
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address for your payment receipt.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payments/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: normalizedPaymentType,
          eventId,
          eventTitle,
          tierName,
          quantity: effectiveQuantity,
          email,
          phone,
          referrerId,
          contestantId,
          contestantKey: contestantId,
          packageId,
          packageName,
          requestedVotes: effectiveVoteCount,
          productId,
          deliveryLocation,
          notes,
        }),
      });
      const data = await readJsonSafely(response);

      if (!response.ok || !data?.success || !data?.accessCode) {
        setError(data?.message || 'Unable to start card checkout.');
        return;
      }

      setCheckoutRequestId(data.reference || '');
      const { default: PaystackPop } = await import('@paystack/inline-js');
      const paystack = new PaystackPop();
      paystack.resumeTransaction(data.accessCode, {
        onSuccess: async (transaction) => {
          setLoading(true);
          setError('');
          try {
            const verifyResponse = await fetch(
              '/api/payments/paystack/verify',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: transaction.reference }),
              }
            );
            const verification = await readJsonSafely(verifyResponse);
            if (
              !verifyResponse.ok ||
              !verification?.success ||
              !verification?.paid
            ) {
              setError(
                verification?.message ||
                  'Payment could not be verified yet. Please contact support before retrying.'
              );
              return;
            }
            setPaymentStatus('paid');
            setFeedback(
              isTicketPurchase
                ? `Payment received. Ticket confirmed: ${verification.ticketCode}`
                : isVotePurchase
                  ? 'Payment received. Votes confirmed.'
                  : 'Payment received. Merchandise order confirmed.'
            );
            if (typeof onPaymentSuccess === 'function') {
              onPaymentSuccess(verification);
            }
          } catch {
            setError(
              'Payment was submitted, but confirmation is taking longer than expected. Please contact support before retrying.'
            );
          } finally {
            setLoading(false);
          }
        },
        onCancel: async () => {
          if (isMerchPurchase && data.reference) {
            try {
              await fetch('/api/payments/paystack/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: data.reference }),
              });
            } catch {}
          }
          setError('Card checkout was canceled. You can try again.');
        },
        onError: (checkoutError) => {
          setError(
            checkoutError?.message || 'Paystack checkout could not be opened.'
          );
        },
      });
    } catch {
      setError('Unable to reach the card checkout service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={
          className ||
          'inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90'
        }
        onClick={() => setOpen(true)}
      >
        <Smartphone className="mr-1.5 h-4 w-4" />
        {ctaLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isTicketPurchase
                    ? 'Ticket Checkout'
                    : isVotePurchase
                      ? 'Vote Checkout'
                      : isMerchPurchase
                        ? 'Merchandise Checkout'
                        : 'M-Pesa Checkout'}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {eventTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                aria-label="Close checkout"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isTicketPurchase || isVotePurchase ? (
              <div
                className="mb-4 grid grid-cols-2 rounded-lg border border-border p-1"
                role="tablist"
                aria-label="Payment method"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={paymentMethod === 'mpesa'}
                  onClick={() => setPaymentMethod('mpesa')}
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    paymentMethod === 'mpesa'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  M-PESA
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={paymentMethod === 'card'}
                  onClick={() => setPaymentMethod('card')}
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    paymentMethod === 'card'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  CARD
                </button>
              </div>
            ) : null}
            {paymentMethod === 'card' ? (
              <p className="-mt-2 mb-4 text-xs text-muted-foreground">
                Visa card payments are securely processed by Paystack.
              </p>
            ) : null}

            <p className="mb-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
              Amount: <strong>{formatKsh(payableAmount)}</strong>
              {isTicketPurchase || isMerchPurchase ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({effectiveQuantity} ticket{effectiveQuantity > 1 ? 's' : ''}{' '}
                  x {formatKsh(amount)})
                </span>
              ) : isVotePurchase ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({effectiveVoteCount} vote{effectiveVoteCount > 1 ? 's' : ''}{' '}
                  x {formatKsh(voteUnitAmount)})
                </span>
              ) : null}
            </p>

            <form
              className="space-y-3"
              onSubmit={
                paymentMethod === 'card'
                  ? initiateCardCheckout
                  : initiateCheckout
              }
            >
              {isTicketPurchase ? (
                <label className="block text-sm text-muted-foreground">
                  {isTicketPurchase ? 'Ticket quantity' : 'Quantity'}
                  <input
                    type="number"
                    min="1"
                    max={safeMaxQuantity || undefined}
                    value={effectiveQuantity}
                    onChange={(e) =>
                      setModalQuantity(
                        safeMaxQuantity
                          ? Math.min(
                              safeMaxQuantity,
                              Math.max(
                                1,
                                Math.round(Number(e.target.value || 1))
                              )
                            )
                          : Math.max(1, Math.round(Number(e.target.value || 1)))
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TICKET_MODAL_PRESETS.map((preset) => {
                      const active = effectiveQuantity === preset;
                      const disabled =
                        Boolean(safeMaxQuantity) && preset > safeMaxQuantity;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={disabled}
                          onClick={() => setModalQuantity(preset)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:border-primary/50'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {preset}x
                        </button>
                      );
                    })}
                  </div>
                </label>
              ) : isVotePurchase ? (
                <label className="block text-sm text-muted-foreground">
                  Vote quantity
                  <input
                    type="number"
                    min="1"
                    max={safeMaxVoteQuantity || undefined}
                    value={effectiveVoteCount}
                    onChange={(e) =>
                      setModalQuantity(
                        safeMaxVoteQuantity
                          ? Math.min(
                              safeMaxVoteQuantity,
                              Math.max(
                                1,
                                Math.round(Number(e.target.value || 1))
                              )
                            )
                          : Math.max(1, Math.round(Number(e.target.value || 1)))
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {VOTE_MODAL_PRESETS.map((preset) => {
                      const active = effectiveVoteCount === preset;
                      const disabled =
                        Boolean(safeMaxVoteQuantity) &&
                        preset > safeMaxVoteQuantity;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={disabled}
                          onClick={() => setModalQuantity(preset)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:border-primary/50'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </label>
              ) : null}

              <label className="block text-sm text-muted-foreground">
                {paymentMethod === 'card'
                  ? 'Phone Number (optional)'
                  : 'M-Pesa Number'}
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  required={paymentMethod === 'mpesa'}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>

              <label className="block text-sm text-muted-foreground">
                {isTicketPurchase
                  ? 'Email for ticket delivery'
                  : 'Email for receipt'}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required={isTicketPurchase || paymentMethod === 'card'}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              {feedback ? (
                <p className="text-sm text-success">{feedback}</p>
              ) : null}

              {paymentStatus !== 'idle' ? (
                <div className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    Status:{' '}
                    <span
                      className={`font-semibold ${
                        paymentStatus === 'paid'
                          ? 'text-success'
                          : paymentStatus === 'failed'
                            ? 'text-destructive'
                            : 'text-warning'
                      }`}
                    >
                      {paymentStatus.toUpperCase()}
                    </span>
                  </p>
                  {statusNote ? <p className="mt-1">{statusNote}</p> : null}
                  {checkoutRequestId ? (
                    <p className="mt-1 truncate">Ref: {checkoutRequestId}</p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  loading ||
                  ((isTicketPurchase || paymentMethod === 'card') &&
                    !isValidEmail(email))
                }
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initiating...
                  </>
                ) : paymentMethod === 'card' ? (
                  'Continue to Paystack'
                ) : (
                  'Request STK Push'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
