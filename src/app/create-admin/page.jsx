'use client';

import { useState } from 'react';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  secret: '',
};

export default function CreateAdminPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [action, setAction] = useState('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const method =
        action === 'update' ? 'PUT' : action === 'delete' ? 'DELETE' : 'POST';
      const payload = { ...form };

      if (action === 'delete') {
        const { firstName, lastName, password, ...deletePayload } = payload;
        delete deletePayload.email;
        if (!deletePayload.secret) {
          throw new Error('Secret word is required to delete the superadmin.');
        }
        Object.assign(deletePayload, {
          email: form.email || '',
        });
      }

      const response = await fetch('/api/create-super', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Superadmin operation failed.');
      }

      setSuccess(data.message || 'Superadmin action completed successfully.');
      if (action !== 'delete') {
        setForm(INITIAL_FORM);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Super admin control
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Create, update, or delete super admin
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This page only manages the super admin account and requires the
            secret word.
          </p>
        </div>

        <div className="mb-5 flex gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
          {['create', 'update', 'delete'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAction(mode)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                action === mode
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {action !== 'delete' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-slate-300">First name</span>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required={action !== 'delete'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
                  placeholder="John"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-slate-300">Last name</span>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required={action !== 'delete'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
                  placeholder="Doe"
                />
              </label>
            </div>
          ) : null}

          {action !== 'delete' ? (
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-300">Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required={action !== 'delete'}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
                placeholder="superadmin@example.com"
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-300">
                Superadmin email
              </span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
                placeholder="Optional: specific superadmin email"
              />
            </label>
          )}

          {action !== 'delete' ? (
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-300">Password</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required={action !== 'delete'}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
                placeholder={
                  action === 'update'
                    ? 'Leave blank to keep current password'
                    : 'Create a strong password'
                }
              />
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-300">
              {action === 'delete'
                ? 'Delete secret word'
                : 'Superadmin secret word'}
            </span>
            <input
              type="password"
              name="secret"
              value={form.secret}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
              placeholder="Enter the secret word from .env"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? action === 'create'
                ? 'Creating superadmin...'
                : action === 'update'
                  ? 'Updating superadmin...'
                  : 'Deleting superadmin...'
              : action === 'create'
                ? 'Create superadmin'
                : action === 'update'
                  ? 'Update superadmin'
                  : 'Delete superadmin'}
          </button>
        </form>
      </div>
    </div>
  );
}
