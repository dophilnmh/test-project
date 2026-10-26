'use client';

import { useEffect, useState } from 'react';
import { formatKsh } from '@/lib/currency';

export default function OrganizerShopPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [creating, setCreating] = useState(false);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    status: 'active',
    eventId: '',
  });

  const loadData = async () => {
    const [productsRes, ordersRes] = await Promise.all([
      fetch('/api/shop/products?scope=organizer', { cache: 'no-store' }),
      fetch('/api/shop/orders', { cache: 'no-store' }),
    ]);
    const eventsRes = await fetch('/api/events/organizer', {
      cache: 'no-store',
    });

    const productsData = await productsRes.json();
    const ordersData = await ordersRes.json();
    const eventsData = await eventsRes.json();

    if (productsRes.ok && productsData?.success) {
      setProducts(productsData.products || []);
    }

    if (ordersRes.ok && ordersData?.success) {
      setOrders(ordersData.orders || []);
    }
    if (eventsRes.ok && eventsData?.success) {
      setEvents(eventsData.events || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createProduct = async (event) => {
    event.preventDefault();
    setFeedback('');
    setCreating(true);

    try {
      const imageUrls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const upload = await fetch('/api/uploads/product', {
          method: 'POST',
          body: fd,
        });
        const data = await upload.json();
        if (!upload.ok || !data?.success || !data?.imageUrl) {
          setFeedback(data?.message || 'Unable to upload product image');
          setCreating(false);
          return;
        }
        imageUrls.push(data.imageUrl);
      }

      const response = await fetch('/api/shop/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imageUrls }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setFeedback(data?.message || 'Unable to create product');
        return;
      }

      setFeedback('Product submitted. Waiting for superadmin approval.');
      setForm({
        name: '',
        description: '',
        category: '',
        price: '',
        stock: '',
        status: 'active',
      });
      setFiles([]);
      await loadData();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Organizer Shop</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create products, monitor approvals, and track organizer merchandise
          sales with platform commission splits.
        </p>
      </header>

      {feedback ? (
        <p className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-primary">
          {feedback}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">Add Product</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={createProduct}
        >
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Product name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={form.eventId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, eventId: e.target.value }))
            }
            required
          >
            <option value="">Select approved event</option>
            {events
              .filter((event) => event.status === 'approved')
              .map((event) => (
                <option
                  key={event.eventId || event._id}
                  value={event.eventId || event._id}
                >
                  {event.title}
                </option>
              ))}
          </select>
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
            required
          />
          <input
            type="number"
            min="0"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Price"
            value={form.price}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, price: e.target.value }))
            }
            required
          />
          <input
            type="number"
            min="0"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Stock"
            value={form.stock}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, stock: e.target.value }))
            }
            required
          />
          <label className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">
              Product images (up to 8)
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) =>
                setFiles(Array.from(e.target.files || []).slice(0, 8))
              }
            />
          </label>
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            required
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 md:col-span-2"
          >
            {creating ? 'Submitting...' : 'Submit Product'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">My Products</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Stock</th>
                <th className="px-2 py-2">Approval</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item._id} className="border-b border-border/60">
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{formatKsh(item.price)}</td>
                  <td className="px-2 py-2">{item.stock}</td>
                  <td className="px-2 py-2">
                    {item.approvalStatus}
                    {item.approvalNote ? (
                      <p className="text-xs text-muted-foreground">
                        {item.approvalNote}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">My Sales</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Platform Share</th>
                <th className="px-2 py-2">Organizer Share</th>
                <th className="px-2 py-2">Payment / fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b border-border/60">
                  <td className="px-2 py-2">{order.productName}</td>
                  <td className="px-2 py-2">{formatKsh(order.totalAmount)}</td>
                  <td className="px-2 py-2">
                    {formatKsh(order.platformCommissionAmount || 0)}
                  </td>
                  <td className="px-2 py-2">
                    {formatKsh(order.organizerEarningsAmount || 0)}
                  </td>
                  <td className="px-2 py-2">
                    {order.paymentStatus === 'failed' ? (
                      <div>
                        <p className="font-medium text-destructive">
                          Payment failed
                        </p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          {order.resultDesc || 'Payment was not completed.'}
                        </p>
                      </div>
                    ) : order.paymentStatus === 'pending' ? (
                      <div>
                        <p className="font-medium">Payment pending</p>
                        <p className="text-xs text-muted-foreground">
                          Fulfillment: {order.status}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p>{order.status}</p>
                        <p className="text-xs text-muted-foreground">
                          Payment paid
                        </p>
                      </div>
                    )}
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
