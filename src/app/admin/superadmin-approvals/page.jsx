'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatKsh } from '@/lib/currency';

function fmtDate(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

export default function SuperadminApprovalInboxPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [editingBlogId, setEditingBlogId] = useState('');
  const [editingCoverFile, setEditingCoverFile] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    coverImageUrl: '',
    category: '',
    tags: '',
    authorName: '',
    readMinutes: 3,
  });
  const [productCommissionDrafts, setProductCommissionDrafts] = useState({});
  const [pending, setPending] = useState({
    products: [],
    blogs: [],
    funds: [],
  });
  const [recentAudit, setRecentAudit] = useState({
    products: [],
    blogs: [],
    funds: [],
  });
  const [totals, setTotals] = useState({
    pendingProducts: 0,
    pendingBlogs: 0,
    pendingFunds: 0,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/approval-inbox', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to load approval inbox');
        return;
      }

      setPending(data.pending || { products: [], blogs: [], funds: [] });
      setRecentAudit(
        data.recentAudit || { products: [], blogs: [], funds: [] }
      );
      setTotals(
        data.totals || {
          pendingProducts: 0,
          pendingBlogs: 0,
          pendingFunds: 0,
        }
      );
    } catch {
      setError('Unable to load approval inbox right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!editingBlogId) return;
    const el = document.getElementById('superadmin-blog-edit-editor');
    if (!el) return;
    el.innerHTML = String(editForm.content || '');
  }, [editingBlogId]);

  const auditRows = useMemo(
    () =>
      [
        ...(recentAudit.products || []),
        ...(recentAudit.blogs || []),
        ...(recentAudit.funds || []),
      ].sort(
        (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()
      ),
    [recentAudit]
  );

  const updateProductApproval = async (
    productId,
    approvalStatus,
    commissionPercent
  ) => {
    if (
      approvalStatus === 'approved' &&
      (!String(commissionPercent ?? '').trim() ||
        !Number.isFinite(Number(commissionPercent)) ||
        Number(commissionPercent) < 0 ||
        Number(commissionPercent) > 100)
    ) {
      setError('Enter a commission percentage from 0 to 100.');
      return;
    }

    setSaving(true);
    setError('');
    setFeedback('');

    let approvalNote = '';
    if (approvalStatus === 'rejected') {
      approvalNote = window.prompt('Enter rejection reason') || '';
      if (!approvalNote.trim()) {
        setError('Rejection reason is required.');
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/shop/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalStatus,
          approvalNote,
          ...(approvalStatus === 'approved'
            ? { commissionPercent: Number(commissionPercent) }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update product approval');
        return;
      }

      setFeedback(data?.message || `Product ${approvalStatus}`);
      await loadData();
    } catch {
      setError('Unable to update product approval');
    } finally {
      setSaving(false);
    }
  };

  const updateBlogStatus = async (postId, status) => {
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const payload = { status };

      if (status === 'rejected') {
        const reason = window.prompt('Enter rejection reason') || '';
        if (!reason.trim()) {
          setError('Rejection reason is required.');
          setSaving(false);
          return;
        }
        payload.rejectionReason = reason;
      }

      if (status === 'published') {
        const otpReq = await fetch(`/api/blogs/${postId}/publish-otp`, {
          method: 'POST',
        });
        const otpData = await otpReq.json();
        if (!otpReq.ok || !otpData?.success) {
          setError(otpData?.message || 'Unable to send publish OTP');
          setSaving(false);
          return;
        }

        const otp = window.prompt('Enter OTP sent to superadmin email');
        if (!String(otp || '').trim()) {
          setError('OTP is required to publish');
          setSaving(false);
          return;
        }
        payload.otp = String(otp).trim();
      }

      const response = await fetch(`/api/blogs/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update blog status');
        return;
      }

      setFeedback(data?.message || `Blog ${status}`);
      await loadData();
    } catch {
      setError('Unable to update blog status');
    } finally {
      setSaving(false);
    }
  };

  const openBlogEditor = (post) => {
    setEditingBlogId(post?._id || '');
    setEditingCoverFile(null);
    setEditForm({
      title: String(post?.title || ''),
      excerpt: String(post?.excerpt || ''),
      content: String(post?.content || ''),
      coverImageUrl: String(post?.coverImageUrl || ''),
      category: String(post?.category || ''),
      tags: Array.isArray(post?.tags) ? post.tags.join(', ') : '',
      authorName: String(post?.authorName || ''),
      readMinutes: Number(post?.readMinutes || 3),
    });
  };

  const closeBlogEditor = () => {
    setEditingBlogId('');
    setEditingCoverFile(null);
  };

  const submitBlogEdit = async (event) => {
    event.preventDefault();
    if (!editingBlogId) return;

    if (!String(editForm.title || '').trim()) {
      setError('Blog title is required.');
      return;
    }

    if (!String(editForm.excerpt || '').trim()) {
      setError('Blog excerpt is required.');
      return;
    }

    if (!String(editForm.content || '').trim()) {
      setError('Blog content is required.');
      return;
    }

    setSaving(true);
    setUploadingCover(false);
    setError('');
    setFeedback('');

    try {
      let coverImageUrl = String(editForm.coverImageUrl || '').trim();
      if (editingCoverFile) {
        setUploadingCover(true);
        const fd = new FormData();
        fd.append('file', editingCoverFile);
        const upload = await fetch('/api/uploads/blog-cover', {
          method: 'POST',
          body: fd,
        });
        const uploadData = await upload.json();
        if (!upload.ok || !uploadData?.success || !uploadData?.imageUrl) {
          setError(uploadData?.message || 'Cover image upload failed');
          return;
        }
        coverImageUrl = String(uploadData.imageUrl);
      }

      const response = await fetch(`/api/blogs/${editingBlogId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(editForm.title || '').trim(),
          excerpt: String(editForm.excerpt || '').trim(),
          content: String(editForm.content || ''),
          coverImageUrl,
          category: String(editForm.category || '').trim(),
          tags: String(editForm.tags || ''),
          authorName: String(editForm.authorName || '').trim(),
          readMinutes: Math.max(1, Number(editForm.readMinutes || 1)),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update blog');
        return;
      }

      setFeedback('Blog updated');
      closeBlogEditor();
      await loadData();
    } catch {
      setError('Unable to update blog');
    } finally {
      setSaving(false);
      setUploadingCover(false);
    }
  };

  const applyEditFormat = (command, value) => {
    const editor = document.getElementById('superadmin-blog-edit-editor');
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    setEditForm((prev) => ({ ...prev, content: editor.innerHTML }));
  };

  const insertEditLink = () => {
    const url = window.prompt('Enter URL (https://...)');
    if (!url) return;
    applyEditFormat('createLink', url);
  };

  const deleteBlog = async (post) => {
    const confirmed = window.confirm(
      `Delete blog "${post.title}" permanently?`
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(`/api/blogs/${post._id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to delete blog');
        return;
      }
      setFeedback('Blog deleted');
      await loadData();
    } catch {
      setError('Unable to delete blog');
    } finally {
      setSaving(false);
    }
  };

  const reviewFund = async (requestId, status) => {
    setSaving(true);
    setError('');
    setFeedback('');

    let reviewNote = '';
    if (status === 'rejected') {
      reviewNote = window.prompt('Enter rejection reason') || '';
      if (!reviewNote.trim()) {
        setError('Rejection reason is required.');
        setSaving(false);
        return;
      }
    } else {
      reviewNote =
        window.prompt('Optional note for dual email approval request') || '';
    }

    try {
      const response = await fetch('/api/admin/fund-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, reviewNote }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.message || 'Unable to update fund request');
        return;
      }
      setFeedback(data?.message || 'Fund request updated');
      await loadData();
    } catch {
      setError('Unable to update fund request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">
          Superadmin Approval Inbox
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Central inbox for product, blog, and disbursement approvals with
          recent audit actions.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Pending Products</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.pendingProducts}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Pending Blogs</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.pendingBlogs}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Pending Funds</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.pendingFunds}
          </p>
        </article>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card/70 p-2">
        {[
          { key: 'products', label: 'Products' },
          { key: 'blogs', label: 'Blogs' },
          { key: 'funds', label: 'Funds' },
          { key: 'audit', label: 'Audit Trail' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-foreground hover:border-primary/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Loading approval inbox...
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {feedback}
        </p>
      ) : null}

      {activeTab === 'products' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Pending Product Approvals
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-3">Product</th>
                  <th className="px-2 py-3">Organizer</th>
                  <th className="px-2 py-3">Price</th>
                  <th className="px-2 py-3">Created By</th>
                  <th className="px-2 py-3">NimblyPolls Commission (%)</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(pending.products || []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                      No pending products.
                    </td>
                  </tr>
                ) : (
                  pending.products.map((product) => (
                    <tr key={product._id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium text-foreground">
                        {product.name}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {product.organizerName || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {formatKsh(product.price)}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {product.createdByEmail}
                      </td>
                      <td className="px-2 py-3">
                        <label className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            aria-label={`NimblyPolls commission percentage for ${product.name}`}
                            value={
                              productCommissionDrafts[String(product._id)] ??
                              String(product.commissionPercent ?? 0)
                            }
                            onChange={(event) =>
                              setProductCommissionDrafts((previous) => ({
                                ...previous,
                                [String(product._id)]: event.target.value,
                              }))
                            }
                            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
                          />
                          <span>%</span>
                        </label>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              const productId = String(product._id);
                              updateProductApproval(
                                product._id,
                                'approved',
                                productCommissionDrafts[productId] ??
                                  product.commissionPercent ??
                                  0
                              );
                            }}
                            className="rounded-md border border-success/60 px-3 py-1 text-xs text-success"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              updateProductApproval(product._id, 'rejected')
                            }
                            className="rounded-md border border-destructive/60 px-3 py-1 text-xs text-destructive"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'blogs' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Pending Blog Approvals and CRUD
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-3">Title</th>
                  <th className="px-2 py-3">Category</th>
                  <th className="px-2 py-3">Author</th>
                  <th className="px-2 py-3">Created By</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(pending.blogs || []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                      No pending blogs.
                    </td>
                  </tr>
                ) : (
                  pending.blogs.map((post) => (
                    <tr key={post._id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium text-foreground">
                        {post.title}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {post.category}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {post.authorName}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {post.createdByEmail}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              updateBlogStatus(post._id, 'published')
                            }
                            className="rounded-md border border-success/60 px-3 py-1 text-xs text-success"
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              updateBlogStatus(post._id, 'rejected')
                            }
                            className="rounded-md border border-destructive/60 px-3 py-1 text-xs text-destructive"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => openBlogEditor(post)}
                            className="rounded-md border border-border px-3 py-1 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => deleteBlog(post)}
                            className="rounded-md border border-destructive/50 px-3 py-1 text-xs text-destructive"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'funds' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Disbursement Approval Queue
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-3">Organizer</th>
                  <th className="px-2 py-3">Payout</th>
                  <th className="px-2 py-3">Transaction Cost</th>
                  <th className="px-2 py-3">M-PESA</th>
                  <th className="px-2 py-3">State</th>
                  <th className="px-2 py-3">Email Approvals</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(pending.funds || []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={7}>
                      No pending fund requests.
                    </td>
                  </tr>
                ) : (
                  pending.funds.map((request) => (
                    <tr key={request._id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium text-foreground">
                        {request.organizerName}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {formatKsh(request.amount)}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {formatKsh(request.transactionCost || 0)}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {request.mpesaNumber}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {request.status}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {Number(request.emailApprovalCompleted || 0)}/
                        {Number(request.emailApprovalRequired || 2)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => reviewFund(request._id, 'approved')}
                            className="rounded-md border border-success/60 px-3 py-1 text-xs text-success"
                          >
                            Request Email Approvals
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => reviewFund(request._id, 'rejected')}
                            className="rounded-md border border-destructive/60 px-3 py-1 text-xs text-destructive"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="rounded-2xl border border-border bg-card/85 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Recent Audit Trail
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-3">Type</th>
                  <th className="px-2 py-3">Title</th>
                  <th className="px-2 py-3">State</th>
                  <th className="px-2 py-3">Actor</th>
                  <th className="px-2 py-3">Note</th>
                  <th className="px-2 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                      No audit records yet.
                    </td>
                  </tr>
                ) : (
                  auditRows.map((row) => (
                    <tr
                      key={`${row.type}-${row.id}-${row.at || ''}`}
                      className="border-b border-border/60"
                    >
                      <td className="px-2 py-3 text-muted-foreground">
                        {row.type}
                      </td>
                      <td className="px-2 py-3 font-medium text-foreground">
                        {row.title}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {row.state}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {row.actor || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {row.note || '-'}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {fmtDate(row.at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {editingBlogId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Edit Blog Post
              </h3>
              <button
                type="button"
                onClick={closeBlogEditor}
                className="rounded-md border border-border px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={submitBlogEdit}
            >
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Category"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, category: e.target.value }))
                }
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Author name"
                value={editForm.authorName}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    authorName: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                min="1"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Read minutes"
                value={editForm.readMinutes}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    readMinutes: e.target.value,
                  }))
                }
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="Tags (comma-separated)"
                value={editForm.tags}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
              <label className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Upload new cover image (optional)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setEditingCoverFile(e.target.files?.[0] || null)
                  }
                />
                {editingCoverFile ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selected: {editingCoverFile.name}
                  </p>
                ) : null}
              </label>
              <textarea
                className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="Short excerpt"
                value={editForm.excerpt}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, excerpt: e.target.value }))
                }
                required
              />
              <div className="rounded-lg border border-input bg-background md:col-span-2">
                <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
                  <button
                    type="button"
                    onClick={() => applyEditFormat('bold')}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    Bold
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEditFormat('italic')}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    Italic
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEditFormat('formatBlock', 'h2')}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEditFormat('insertUnorderedList')}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    Bullet List
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEditFormat('insertOrderedList')}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    Numbered List
                  </button>
                  <button
                    type="button"
                    onClick={insertEditLink}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEditFormat('removeFormat')}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    Clear
                  </button>
                </div>

                <div
                  id="superadmin-blog-edit-editor"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      content: e.currentTarget.innerHTML,
                    }))
                  }
                  className="min-h-52 px-3 py-2 text-sm outline-none"
                  data-placeholder="Write full article content here..."
                />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving || uploadingCover}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {saving || uploadingCover ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  disabled={saving || uploadingCover}
                  onClick={closeBlogEditor}
                  className="rounded-md border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
