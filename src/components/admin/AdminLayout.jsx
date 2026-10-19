'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  BarChart3,
  BookText,
  CalendarCheck2,
  LayoutDashboard,
  Mail,
  Menu,
  ShoppingCart,
  Store,
  ShieldCheck,
  Settings,
  Ticket,
  ReceiptText,
  ClipboardCheck,
  Vote,
  Trophy,
  UserCog,
  X,
  LogOut,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const menuItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
  { icon: CalendarCheck2, label: 'Approvals', href: '/admin/approvals' },
  { icon: ShoppingCart, label: 'Orders', href: '/admin/orders' },
  { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
  { icon: Store, label: 'Shop', href: '/admin/shop' },
  { icon: Vote, label: 'Polls CRUD', href: '/admin/voting' },
  { icon: Trophy, label: 'Competitions CRUD', href: '/admin/competitions' },
  { icon: BookText, label: 'Blogs', href: '/admin/blogs' },
  { icon: Mail, label: 'Contact Inbox', href: '/admin/contact' },
  { icon: CalendarCheck2, label: 'Events CRUD', href: '/admin/events' },
  { icon: UserCog, label: 'Organizers', href: '/admin/organizers' },
  { icon: Ticket, label: 'Ticket Health', href: '/admin/tickets' },
  {
    icon: ReceiptText,
    label: 'M-Pesa Recovery',
    href: '/admin/payments',
  },
  {
    icon: ClipboardCheck,
    label: 'Approval Inbox',
    href: '/admin/superadmin-approvals',
  },
  { icon: UserCog, label: 'User Access', href: '/admin/users' },
  { icon: Settings, label: 'Profile Settings', href: '/admin/settings' },
];

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

const formatRole = (role = 'admin') =>
  String(role)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const AdminLayout = ({ children }) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  );
  const [profileImage, setProfileImage] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('nimbly-admin-avatar') || '';
  });
  const logoutTimeoutRef = useRef(null);
  const userName = session?.user?.name || session?.user?.email || 'Admin';
  const role = session?.user?.role || 'admin';
  const initials = getInitials(userName);
  const today = new Date();
  const greeting = getGreeting();

  const clearIdleLogout = useCallback(() => {
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  }, []);

  const scheduleIdleLogout = useCallback(() => {
    clearIdleLogout();
    logoutTimeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: '/login?reason=idle' });
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleLogout]);

  useEffect(() => {
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];
    const handleActivity = () => scheduleIdleLogout();

    scheduleIdleLogout();

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    return () => {
      clearIdleLogout();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [clearIdleLogout, scheduleIdleLogout]);

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
    if (!isJpeg) {
      alert('Please upload a .jpeg image only.');
      event.target.value = '';
      return;
    }

    if (file.size > 1024 * 1024) {
      alert('Image must be 1MB or smaller.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result || '');
      setProfileImage(imageData);
      localStorage.setItem('nimbly-admin-avatar', imageData);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="flex min-h-screen bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex shrink-0 items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sidebar-foreground"
          >
            <span className="rounded-lg bg-sidebar-primary/20 p-2 text-sidebar-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="font-semibold">NimblyPolls Admin</span>
          </Link>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5 text-sidebar-foreground" />
          </button>
        </div>

        <div className="mb-6 shrink-0 rounded-3xl border border-sidebar-border bg-gradient-to-br from-sidebar-accent via-sidebar-accent/80 to-sidebar/80 p-4 shadow-lg shadow-black/10">
          <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/65">
            <span>{mounted ? greeting : ''}</span>
            <span>
              {mounted
                ? today.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                  })
                : ''}
            </span>
          </div>

          <div className="relative mx-auto h-20 w-20">
            <label className="group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-sidebar-primary/40 bg-sidebar-primary/15 shadow-xl ring-4 ring-sidebar-primary/10 transition hover:scale-[1.02]">
              {profileImage ? (
                <Image
                  src={profileImage}
                  alt="Profile"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-sidebar-primary">
                  {initials}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 opacity-0 transition group-hover:opacity-100">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white">
                  Upload
                </span>
              </span>
              <input
                type="file"
                accept=".jpeg,.jpg,image/jpeg"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-4 text-center">
            <p className="text-lg font-semibold text-sidebar-foreground">
              {userName}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
              {formatRole(role)}
            </p>
            <p className="mt-2 text-[10px] text-sidebar-foreground/60">
              {mounted
                ? today.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 pr-1">
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="mt-4 shrink-0 space-y-2 border-t border-sidebar-border pt-4">
          <Link
            href="/events"
            className="block rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
          >
            View Public Events
          </Link>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card/70 px-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6 text-foreground" />
          </button>
          <div>
            <p className="text-sm text-muted-foreground">Admin Portal</p>
            <h2 className="text-lg font-semibold text-foreground">
              Event Moderation & Ticket Ops
            </h2>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};
