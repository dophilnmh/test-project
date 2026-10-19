'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const BLOG_STATUSES = [
  'draft',
  'pending_approval',
  'published',
  'rejected',
  'archived',
];

export default function AdminBlogsPage() {
  const editorRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    coverImageUrl: '',
    category: '',
    tags: '',
    authorName: '',
    readMinutes: 3,
    status: 'pending_approval',
  });

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/blogs?scope=admin', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        setPosts(data.posts || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const totals = useMemo(() => {
    const published = posts.filter(
      (item) => item.status === 'published'
    ).length;
    const drafts = posts.filter((item) => item.status === 'draft').length;
    return { published, drafts };
  }, [posts]);

  const createPost = async (event) => {
    event.preventDefault();
    setFeedback('');
    setCreating(true);

    try {
      let coverImageUrl = String(form.coverImageUrl || '').trim();
      if (coverFile) {
        setUploadingCover(true);
        const fd = new FormData();
        fd.append('file', coverFile);
        const upload = await fetch('/api/uploads/blog-cover', {
          method: 'POST',
          body: fd,
        });
        const uploadData = await upload.json();
        if (!upload.ok || !uploadData?.success || !uploadData?.imageUrl) {
          setFeedback(uploadData?.message || 'Cover image upload failed');
          setCreating(false);
          setUploadingCover(false);
          return;
        }
        coverImageUrl = uploadData.imageUrl;
        setUploadingCover(false);
      }

      const response = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          coverImageUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setFeedback(data.message || 'Unable to create post');
        return;
      }

      setFeedback(data.message || 'Post created');
      setForm({
        title: '',
        excerpt: '',
        content: '',
        coverImageUrl: '',
        category: '',
        tags: '',
        authorName: '',
        readMinutes: 3,
        status: 'pending_approval',
      });
      setCoverFile(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      await loadPosts();
    } finally {
      setCreating(false);
      setUploadingCover(false);
    }
  };

  const applyFormat = (command, value) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setForm((prev) => ({ ...prev, content: editorRef.current.innerHTML }));
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL (https://...)');
    if (!url) return;
    applyFormat('createLink', url);
  };

  const updateStatus = async (id, status) => {
    setFeedback('');

    const payload = { status };

    if (status === 'rejected') {
      const reason = window.prompt('Enter rejection reason') || '';
      if (!reason.trim()) {
        setFeedback('Rejection reason is required.');
        return;
      }
      payload.rejectionReason = reason;
    }

    if (status === 'published') {
      const otpReq = await fetch(`/api/blogs/${id}/publish-otp`, {
        method: 'POST',
      });
      const otpData = await otpReq.json();
      if (!otpReq.ok || !otpData?.success) {
        setFeedback(otpData?.message || 'Unable to send publish OTP');
        return;
      }

      const otp = window.prompt('Enter OTP sent to superadmin email');
      if (!String(otp || '').trim()) {
        setFeedback('OTP is required to publish.');
        return;
      }
      payload.otp = String(otp).trim();
    }

    const response = await fetch(`/api/blogs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      setFeedback(data.message || 'Unable to update post');
      return;
    }

    setFeedback(data.message || 'Post updated');
    await loadPosts();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Blog Publishing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create and publish articles for announcements, industry updates, and
          platform stories.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Published Posts</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.published}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Draft Posts</p>
          <p className="text-2xl font-semibold text-foreground">
            {totals.drafts}
          </p>
        </article>
      </section>

      {feedback ? (
        <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-primary">
          {feedback}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">Create Post</h2>

        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={createPost}>
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
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
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Author name"
            value={form.authorName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, authorName: e.target.value }))
            }
          />
          <input
            type="number"
            min="1"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Read minutes"
            value={form.readMinutes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, readMinutes: e.target.value }))
            }
          />
          <label className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">
              Cover image upload
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
            />
            {coverFile ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Selected: {coverFile.name}
              </p>
            ) : null}
          </label>
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tags: e.target.value }))
            }
          />
          <textarea
            className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Short excerpt"
            value={form.excerpt}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, excerpt: e.target.value }))
            }
            required
          />
          <div className="rounded-lg border border-input bg-background md:col-span-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
              <button
                type="button"
                onClick={() => applyFormat('bold')}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => applyFormat('italic')}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => applyFormat('formatBlock', 'h2')}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => applyFormat('insertUnorderedList')}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Bullet List
              </button>
              <button
                type="button"
                onClick={() => applyFormat('insertOrderedList')}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Numbered List
              </button>
              <button
                type="button"
                onClick={insertLink}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => applyFormat('removeFormat')}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                Clear
              </button>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) =>
                setForm((prev) => ({
                  ...prev,
                  content: e.currentTarget.innerHTML,
                }))
              }
              className="min-h-44 px-3 py-2 text-sm outline-none"
              data-placeholder="Write full article content here..."
            />
          </div>

          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground md:col-span-2">
            <p className="font-semibold text-foreground/90">
              Editor Preview (HTML)
            </p>
            <p className="mt-1 break-all">{form.content || '<empty>'}</p>
          </div>
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            {BLOG_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={creating || uploadingCover}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
          >
            {creating || uploadingCover
              ? uploadingCover
                ? 'Uploading cover...'
                : 'Saving...'
              : 'Save Blog Post'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-6">
        <h2 className="text-xl font-semibold text-foreground">Post Queue</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading posts...</p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-3">Title</th>
                <th className="px-2 py-3">Category</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Published</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post._id} className="border-b border-border/60">
                  <td className="px-2 py-3">{post.title}</td>
                  <td className="px-2 py-3">{post.category}</td>
                  <td className="px-2 py-3">{post.status}</td>
                  <td className="px-2 py-3">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {BLOG_STATUSES.map((status) => (
                        <button
                          key={`${post._id}-${status}`}
                          type="button"
                          onClick={() => updateStatus(post._id, status)}
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
