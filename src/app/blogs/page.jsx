'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock3, Newspaper } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function BlogsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/blogs', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data?.success) {
          setPosts(data.posts || []);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  const stats = useMemo(() => {
    const total = posts.length;
    const categories = new Set(posts.map((item) => item.category)).size;
    return { total, categories };
  }, [posts]);

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Insights
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              NimblyPolls Blog & Stories
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              News, strategy, and behind-the-scenes updates across ticketing,
              voting, merchandise, and event growth.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:w-[320px]">
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Published Posts</p>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
            </article>
            <article className="rounded-xl border border-border bg-card/80 p-3">
              <p className="text-xs text-muted-foreground">Categories</p>
              <p className="text-xl font-bold text-foreground">
                {stats.categories}
              </p>
            </article>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading blog posts...
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post._id}
              className="overflow-hidden rounded-2xl border border-border bg-card/85 shadow-[0_12px_30px_-22px_rgba(59,130,246,.8)]"
            >
              <div className="h-40 bg-[linear-gradient(145deg,rgba(30,64,175,.42),rgba(59,130,246,.08))] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                    {post.category}
                  </span>
                  <span className="inline-flex rounded-full bg-card/70 px-2.5 py-1 text-[10px] font-bold text-foreground">
                    {post.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                  {post.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {post.excerpt}
                </p>

                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : 'Draft'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {post.readMinutes || 3} min read
                  </li>
                  <li className="flex items-center gap-2">
                    <Newspaper className="h-4 w-4 text-primary" />
                    By {post.authorName || 'NimblyPolls Team'}
                  </li>
                </ul>

                <div className="mt-5 border-t border-border/70 pt-4">
                  <Link
                    href={`/blogs/${post._id}`}
                    className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    Read Article
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}
