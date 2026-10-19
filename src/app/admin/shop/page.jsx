'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatKsh } from '@/lib/currency';

const PRODUCT_STATUSES = ['draft', 'active', 'out_of_stock', 'archived'];
const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];

export default function AdminShopPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    status: 'draft',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsResponse, ordersResponse] = await Promise.all([
        fetch('/api/shop/products?scope=admin', { cache: 'no-store' }),
        fetch('/api/shop/orders', { cache: 'no-store' }),
      ]);

      const productsData = await productsResponse.json();
      const ordersData = await ordersResponse.json();

      if (productsResponse.ok && productsData?.success) {
        setProducts(productsData.products || []);
      }

      if (ordersResponse.ok && ordersData?.success) {
        setOrders(ordersData.orders || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totals = useMemo(() => {
    const activeProducts = products.filter(
      (item) => item.status === 'active'
    ).length;
    const pendingOrders = orders.filter(
      (item) => item.status === 'pending'
    ).length;
    const revenue = orders
      .filter((item) =>
        ['confirmed', 'packed', 'shipped', 'delivered'].includes(item.status)
      )
      .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

    return { activeProducts, pendingOrders, revenue };
  }, [products, orders]);

  const createProduct = async (event) => {
    event.preventDefault();
    setFeedback('');
    setCreating(true);

    try {
      let imageUrls = [];
      if (selectedImages.length > 0) {
        setUploadingImages(true);
        for (const file of selectedImages) {
          const fd = new FormData();
          fd.append('file', file);

          const upload = await fetch('/api/uploads/product', {
            method: 'POST',
            body: fd,
          });
          const uploadData = await upload.json();
          if (!upload.ok || !uploadData?.success || !uploadData?.imageUrl) {
            setFeedback(uploadData?.message || 'Image upload failed');
            setUploadingImages(false);
            setCreating(false);
            return;
          }
          imageUrls.push(uploadData.imageUrl);
        }
        setUploadingImages(false);
      }

      const response = await fetch('/api/shop/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          imageUrls,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedback(data.message || 'Unable to create product');
        return;
      }

      setFeedback(data.message || 'Product created');
      setForm({
        name: '',
        description: '',
        category: '',
        price: '',
        stock: '',
        status: 'draft',
      });
      setSelectedImages([]);
      await loadData();
    } finally {
      setCreating(false);
      setUploadingImages(false);
    }
  };

  const updateProduct = async (productId, updates) => {
    setFeedback('');
    const response = await fetch(`/api/shop/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      setFeedback(data.message || 'Unable to update product');
      return;
    }

    setFeedback(data.message || 'Product updated');
    await loadData();
  };

  const reviewProduct = async (productId, approvalStatus) => {
    let approvalNote = '';
    if (approvalStatus === 'rejected') {
      approvalNote = window.prompt('Enter rejection reason') || '';
      if (!approvalNote.trim()) {
        setFeedback('Rejection reason is required.');
        return;
      }
    }

    await updateProduct(productId, { approvalStatus, approvalNote });
  };

  const updateOrderStatus = async (orderId, status) => {
    setFeedback('');
    const response = await fetch(`/api/shop/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      setFeedback(data.message || 'Unable to update order');
      return;
    }

    setFeedback(data.message || 'Order updated');
    await loadData();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">
          Merchandise Management
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage product catalog, stock levels, and merchandise fulfillment
          pipeline.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Active Products</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.activeProducts}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Pending Orders</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.pendingOrders}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Fulfillment Revenue</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatKsh(totals.revenue)}
          </p>
        </article>
      </section>

      {feedback ? (
        <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-primary">
          {feedback}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">
          Create Product
        </h2>

        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
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
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
            required
          />
          <label className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">
              Product images (multiple)
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setSelectedImages(Array.from(e.target.files || []).slice(0, 8))
              }
            />
            {selectedImages.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedImages.length} image(s) selected
              </p>
            ) : null}
          </label>
          <input
            type="number"
            min="0"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Price (KSH)"
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
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Product description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            required
          />
          <button
            type="submit"
            disabled={creating || uploadingImages}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
          >
            {creating || uploadingImages
              ? uploadingImages
                ? 'Uploading images...'
                : 'Creating...'
              : 'Create Product'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">Products</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-3">Product</th>
                <th className="px-2 py-3">Price</th>
                <th className="px-2 py-3">Stock</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Approval</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id} className="border-b border-border/60">
                  <td className="px-2 py-3">{product.name}</td>
                  <td className="px-2 py-3">{formatKsh(product.price)}</td>
                  <td className="px-2 py-3">{product.stock}</td>
                  <td className="px-2 py-3">{product.status}</td>
                  <td className="px-2 py-3">
                    <div>
                      <p>{product.approvalStatus || 'pending'}</p>
                      {product.approvalNote ? (
                        <p className="text-xs text-muted-foreground">
                          {product.approvalNote}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {PRODUCT_STATUSES.map((status) => (
                        <button
                          key={`${product._id}-${status}`}
                          type="button"
                          onClick={() => updateProduct(product._id, { status })}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-primary/70"
                        >
                          {status}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateProduct(product._id, {
                            stock: Number(product.stock || 0) + 10,
                          })
                        }
                        className="rounded-md border border-primary/40 px-2.5 py-1 text-xs text-primary"
                      >
                        +10 Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewProduct(product._id, 'approved')}
                        className="rounded-md border border-success/50 px-2.5 py-1 text-xs text-success"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewProduct(product._id, 'rejected')}
                        className="rounded-md border border-destructive/50 px-2.5 py-1 text-xs text-destructive"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">
          Order Fulfillment
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-3">Product</th>
                <th className="px-2 py-3">Buyer</th>
                <th className="px-2 py-3">Total</th>
                <th className="px-2 py-3">Location</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b border-border/60">
                  <td className="px-2 py-3">{order.productName}</td>
                  <td className="px-2 py-3">
                    <p>{order.buyerName || order.buyerEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.buyerPhone || '-'}
                    </p>
                  </td>
                  <td className="px-2 py-3">{formatKsh(order.totalAmount)}</td>
                  <td className="px-2 py-3">{order.deliveryLocation}</td>
                  <td className="px-2 py-3">{order.status}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {ORDER_STATUSES.map((status) => (
                        <button
                          key={`${order._id}-${status}`}
                          type="button"
                          onClick={() => updateOrderStatus(order._id, status)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-primary/70"
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
