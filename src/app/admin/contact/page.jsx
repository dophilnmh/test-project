'use client';

import { useEffect, useMemo, useState } from 'react';

const MESSAGE_STATUSES = ['new', 'in_progress', 'resolved', 'archived'];

export default function AdminContactPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contact', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.success) {
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const totals = useMemo(() => {
    return {
      total: messages.length,
      open: messages.filter(
        (item) => item.status === 'new' || item.status === 'in_progress'
      ).length,
      resolved: messages.filter((item) => item.status === 'resolved').length,
    };
  }, [messages]);

  const updateStatus = async (messageId, status) => {
    setFeedback('');

    const response = await fetch(`/api/contact/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      setFeedback(data.message || 'Unable to update status');
      return;
    }

    setFeedback(data.message || 'Message updated');
    await loadMessages();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Contact Inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review incoming support and sales inquiries from the public contact
          page.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Total Messages</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.total}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Open</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.open}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Resolved</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.resolved}
          </p>
        </article>
      </section>

      {feedback ? (
        <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-primary">
          {feedback}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">Message Queue</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Loading messages...
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-3">Sender</th>
                <th className="px-2 py-3">Subject</th>
                <th className="px-2 py-3">Message</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((item) => (
                <tr
                  key={item._id}
                  className="border-b border-border/60 align-top"
                >
                  <td className="px-2 py-3">
                    <p className="font-medium text-foreground">
                      {item.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.phone || '-'}
                    </p>
                  </td>
                  <td className="px-2 py-3">{item.subject}</td>
                  <td className="max-w-[360px] px-2 py-3 text-muted-foreground">
                    {item.message}
                  </td>
                  <td className="px-2 py-3">{item.status}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {MESSAGE_STATUSES.map((status) => (
                        <button
                          key={`${item._id}-${status}`}
                          type="button"
                          onClick={() => updateStatus(item._id, status)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/70"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
