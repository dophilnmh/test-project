'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Layout } from '@/components/layout/Layout';
import { MpesaCheckoutButton } from '@/components/payments/MpesaCheckoutButton';
import { formatKsh } from '@/lib/currency';
import {
  ChevronLeft,
  ChevronRight,
  Package2,
  ShoppingBag,
  Truck,
} from 'lucide-react';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [organizerName, setOrganizerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [orderState, setOrderState] = useState({});
  const [imageIndices, setImageIndices] = useState({});
  const [featuredProductId, setFeaturedProductId] = useState('');
  const touchStartX = useRef({});
  const hasScrolledToProduct = useRef(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const organizerId = new URLSearchParams(window.location.search).get(
        'organizerId'
      );
      const productQuery = organizerId
        ? `?organizerId=${encodeURIComponent(organizerId)}`
        : '';
      const response = await fetch(`/api/shop/products${productQuery}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setProducts(data.products || []);
        setOrganizerName(data.organizerName || '');

        const initial = {};
        for (const product of data.products || []) {
          initial[product._id] = {
            quantity: 1,
            buyerPhone: '',
            buyerEmail: '',
            deliveryLocation: '',
            notes: '',
          };
        }
        setOrderState(initial);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'failed') {
      setError(params.get('message') || 'Card payment could not be completed.');
    }
  }, []);

  useEffect(() => {
    if (!products.length || hasScrolledToProduct.current) return;
    const productId = new URLSearchParams(window.location.search).get(
      'productId'
    );
    if (!productId || !products.some((product) => product._id === productId)) {
      return;
    }
    setFeaturedProductId(productId);

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`product-${productId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolledToProduct.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [products]);

  const totals = useMemo(() => {
    const items = products.length;
    const stock = products.reduce(
      (sum, item) => sum + Number(item.stock || 0),
      0
    );
    return { items, stock };
  }, [products]);

  const updateField = (productId, key, value) => {
    setOrderState((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [key]: value,
      },
    }));
  };

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Merch Store
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              {organizerName
                ? `${organizerName} Shop`
                : 'Official Merchandise Shop'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Sell branded products, track inventory, and process orders from
              one centralized commerce module.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:w-[320px]">
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="text-xl font-bold text-foreground">
                {totals.items}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Units In Stock</p>
              <p className="text-xl font-bold text-foreground">
                {totals.stock}
              </p>
            </article>
          </div>
        </div>

        {feedback ? (
          <div className="mb-4 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-success">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading products...
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const item = orderState[product._id] || {};
            const quantity = Math.max(1, Number(item.quantity || 1));
            const amount = Number(product.price || 0) * quantity;
            const images =
              Array.isArray(product.imageUrls) && product.imageUrls.length
                ? product.imageUrls
                : product.imageUrl
                  ? [product.imageUrl]
                  : [];
            const imageIndex = imageIndices[product._id] || 0;
            const changeImage = (direction) => {
              setImageIndices((previous) => ({
                ...previous,
                [product._id]:
                  (imageIndex + direction + images.length) % images.length,
              }));
            };

            return (
              <article
                key={product._id}
                id={`product-${product._id}`}
                className={`overflow-hidden rounded-2xl border border-border bg-card/85 shadow-[0_12px_30px_-22px_rgba(59,130,246,.8)] ${
                  featuredProductId === product._id
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : ''
                }`}
              >
                <div
                  className="relative h-40 touch-pan-y overflow-hidden bg-[linear-gradient(145deg,rgba(30,64,175,.42),rgba(59,130,246,.08))] p-4"
                  onTouchStart={(event) => {
                    touchStartX.current[product._id] =
                      event.touches[0]?.clientX ?? 0;
                  }}
                  onTouchEnd={(event) => {
                    const startX = touchStartX.current[product._id];
                    const endX = event.changedTouches[0]?.clientX ?? startX;
                    const delta = startX - endX;
                    if (Math.abs(delta) > 40 && images.length > 1) {
                      changeImage(delta > 0 ? 1 : -1);
                    }
                  }}
                >
                  {images.map((imageUrl, index) => (
                    <Image
                      key={`${imageUrl}-${index}`}
                      src={imageUrl}
                      alt={`${product.name} image ${index + 1}`}
                      fill
                      unoptimized
                      aria-hidden={index !== imageIndex}
                      className={`object-contain transition-opacity duration-500 ${
                        index === imageIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                      {product.category}
                    </span>
                    <span className="inline-flex rounded-full bg-card/70 px-2.5 py-1 text-[10px] font-bold text-foreground">
                      {product.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  {images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        aria-label="Previous product image"
                        onClick={() => changeImage(-1)}
                        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next product image"
                        onClick={() => changeImage(1)}
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
                        {images.map((imageUrl, index) => (
                          <button
                            key={`${imageUrl}-dot-${index}`}
                            type="button"
                            aria-label={`Show product image ${index + 1}`}
                            aria-current={index === imageIndex}
                            onClick={() =>
                              setImageIndices((previous) => ({
                                ...previous,
                                [product._id]: index,
                              }))
                            }
                            className={`h-2 w-2 rounded-full ${
                              index === imageIndex ? 'bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="p-5">
                  <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                    {product.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {product.description}
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Package2 className="h-4 w-4 text-primary" />
                      Stock: {product.stock}
                    </li>
                    <li className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      Unit Price: {formatKsh(product.price)}
                    </li>
                    <li className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      Delivery supported
                    </li>
                    <li className="flex items-center gap-2">
                      <Package2 className="h-4 w-4 text-primary" />
                      Images:{' '}
                      {Array.isArray(product.imageUrls) &&
                      product.imageUrls.length > 0
                        ? product.imageUrls.length
                        : product.imageUrl
                          ? 1
                          : 0}
                    </li>
                  </ul>

                  <div className="mt-4 grid gap-2">
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, Number(product.stock || 1))}
                      value={item.quantity || 1}
                      onChange={(e) =>
                        updateField(product._id, 'quantity', e.target.value)
                      }
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Quantity"
                    />
                    <input
                      type="email"
                      value={item.buyerEmail || ''}
                      onChange={(e) =>
                        updateField(product._id, 'buyerEmail', e.target.value)
                      }
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Email for receipt"
                    />
                    <input
                      type="tel"
                      value={item.buyerPhone || ''}
                      onChange={(e) =>
                        updateField(product._id, 'buyerPhone', e.target.value)
                      }
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Phone"
                    />
                    <input
                      type="text"
                      value={item.deliveryLocation || ''}
                      onChange={(e) =>
                        updateField(
                          product._id,
                          'deliveryLocation',
                          e.target.value
                        )
                      }
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Delivery location (estate, landmark, town, etc.)"
                      required
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4">
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {formatKsh(amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order total
                      </p>
                    </div>
                    {Number(product.stock || 0) > 0 ? (
                      <MpesaCheckoutButton
                        eventId={product._id}
                        eventTitle={product.name}
                        paymentType="merchandise"
                        productId={product._id}
                        amount={Number(product.price || 0)}
                        quantity={quantity}
                        maxQuantity={product.stock}
                        customerEmail={item.buyerEmail || ''}
                        deliveryLocation={item.deliveryLocation || ''}
                        notes={item.notes || ''}
                        onPaymentSuccess={() => {
                          setFeedback('Merchandise payment confirmed.');
                          loadProducts();
                        }}
                        buttonLabel="Buy Merchandise"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!loading && products.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No products are currently available in this shop.
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
