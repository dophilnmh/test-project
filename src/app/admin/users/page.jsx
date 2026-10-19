'use client';

import { useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  role: 'admin',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actingId, setActingId] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to load users');
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError('Unable to load managed users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Unable to create user');
        return;
      }
      setFeedback('User created successfully.');
      setForm(initialForm);
      await loadUsers();
    } catch {
      setError('Unable to create user.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (user) => {
    const nextStatus =
      String(user.status || '').toLowerCase() === 'suspended'
        ? 'active'
        : 'suspended';
    const action = nextStatus === 'suspended' ? 'suspend' : 'activate';

    setError('');
    setFeedback('');
    setActingId(user._id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.message || 'Unable to update user status');
        return;
      }
      toast.success(data.message || `User ${action}d successfully.`);
      await loadUsers();
    } catch {
      toast.error('Unable to update user status.');
    } finally {
      setActingId('');
    }
  };

  const deleteUser = async (user) => {
    setActingId(user._id);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.message || 'Unable to delete user');
        return;
      }
      toast.success(data.message || 'User deleted successfully.');
      await loadUsers();
    } catch {
      toast.error('Unable to delete user.');
    } finally {
      setActingId('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-linear-to-br from-card via-card/90 to-background p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          User Access
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Create internal users with access levels
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Superadmins can create admin and finance accounts and review who has
          portal access.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Create User</h2>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={createUser}>
          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="First name"
            value={form.firstName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, firstName: e.target.value }))
            }
            required
          />
          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, lastName: e.target.value }))
            }
            required
          />
          <input
            type="email"
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            required
          />
          <input
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
          <input
            type="password"
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, password: e.target.value }))
            }
            required
          />
          <select
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={form.role}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, role: e.target.value }))
            }
          >
            <option value="admin">Admin</option>
            <option value="finance">Finance</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
          >
            {saving ? 'Creating user...' : 'Create user'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Current Access List
          </h2>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <article
              key={user._id || user.email}
              className="rounded-xl border border-border bg-background/40 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">
                    {user.name ||
                      `${user.firstName || ''} ${user.lastName || ''}`.trim()}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase text-primary">
                    {user.role}
                  </span>
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {user.status || 'Active'}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Manage ${user.email}`}
                        disabled={actingId === user._id}
                        className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {String(user.status || '').toLowerCase() ===
                      'suspended' ? (
                        <DropdownMenuItem onClick={() => updateStatus(user)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Activate user
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => updateStatus(user)}>
                          <Ban className="mr-2 h-4 w-4" />
                          Suspend user
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteUser(user)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Shield
                    className={`h-4 w-4 ${String(user.status || '').toLowerCase() === 'suspended' ? 'text-muted-foreground' : 'text-success'}`}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading users...</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}
    </div>
  );
}
