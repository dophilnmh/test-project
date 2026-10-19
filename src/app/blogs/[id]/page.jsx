'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Clock3, UserCircle2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function BlogDetailsPage() {
  const params = useParams();
  const id = params?.id;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPost = async () => {
      if (!id) return;
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/blogs/${id}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          setError(data.message || 'Unable to load post');
          return;
        }

        setPost(data.post || null);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [id]);

  return (
    <Layout>
      <section className="container mx-auto px-4 py-14 md:py-20">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            Loading article...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {post ? (
          <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-card/85 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {post.category}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
              {post.title}
            </h1>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border px-3 py-1">
                <CalendarDays className="mr-1 h-4 w-4 text-primary" />
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString()
                  : 'Draft'}
              </span>
              <span className="inline-flex items-center rounded-full border border-border px-3 py-1">
                <Clock3 className="mr-1 h-4 w-4 text-primary" />
                {post.readMinutes || 3} min read
              </span>
              <span className="inline-flex items-center rounded-full border border-border px-3 py-1">
                <UserCircle2 className="mr-1 h-4 w-4 text-primary" />
                {post.authorName || 'NimblyPolls Team'}
              </span>
            </div>

            <div
              className="mt-6 space-y-4 text-base leading-8 text-foreground/90"
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
            />
          </article>
        ) : null}
      </section>
    </Layout>
  );
}
