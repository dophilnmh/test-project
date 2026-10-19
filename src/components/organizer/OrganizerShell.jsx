'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  CircleUserRound,
  Cog,
  Store,
  FileImage,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ReceiptText,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const menuGroups = [
  {
    title: 'Workspace',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/organizer' },
      {
        icon: ChartNoAxesCombined,
        label: 'Analytics',
        href: '/organizer/analytics',
      },
      { icon: Store, label: 'Shop', href: '/organizer/shop' },
      {
        icon: ReceiptText,
        label: 'Recovery Tracker',
        href: '/organizer/reconciliation',
      },
      {
        icon: ShieldCheck,
        label: 'Verify Tickets',
        href: '/organizer/tickets/verify',
      },
      { icon: FileImage, label: 'Media Vault', href: '/organizer/media' },
      { icon: Cog, label: 'Settings', href: '/organizer/settings' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { icon: User, label: 'Profile', href: '/organizer/profile' },
      { icon: Megaphone, label: 'Contact Team', href: '/contact' },
    ],
  },
];

const pageMeta = {
  '/organizer': {
    eyebrow: 'Organizer Portal',
    title: 'Dashboard, analytics and media management',
  },
  '/organizer/analytics': {
    eyebrow: 'Organizer Analytics',
    title: 'Revenue, ticket sales and approval performance',
  },
  '/organizer/shop': {
    eyebrow: 'Organizer Shop',
    title: 'Manage products, approvals, and merchandise sales',
  },
  '/organizer/reconciliation': {
    eyebrow: 'Payment Recovery',
    title: 'Track delayed callbacks and confirmed payment recoveries',
  },
  '/organizer/tickets/verify': {
    eyebrow: 'Gate Entry',
    title: 'Verify attendee ticket and SMS entry code',
  },
  '/organizer/media': {
    eyebrow: 'Organizer Media',
    title: 'Uploaded banners and event visual assets',
  },
  '/organizer/profile': {
    eyebrow: 'Organizer Profile',
    title: 'Organization and account details',
  },
  '/organizer/settings': {
    eyebrow: 'Organizer Settings',
    title: 'Ticket types, calendar defaults and promoter access',
  },
};

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_SECONDS = 60;

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'O';

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

const formatRole = (role = 'organizer') =>
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

export function OrganizerShell({ children }) {
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
    return localStorage.getItem('nimbly-organizer-avatar') || '';
  });
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const warningTimeoutRef = useRef(null);
  const logoutTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const activePath = useMemo(() => pathname || '/organizer', [pathname]);
  const header = useMemo(
    () => pageMeta[activePath] || pageMeta['/organizer'],
    [activePath]
  );
  const today = new Date();
  const greeting = getGreeting();
  const userName = session?.user?.name || session?.user?.email || 'Organizer';
  const role = session?.user?.role || 'organizer';

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
      localStorage.setItem('nimbly-organizer-avatar', imageData);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const clearIdleTimers = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    clearIdleTimers();
    setIdleWarningOpen(false);
    signOut({ callbackUrl: '/organizer/login?reason=idle' });
  }, [clearIdleTimers]);

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();

    warningTimeoutRef.current = setTimeout(
      () => {
        setIdleWarningOpen(true);
        setCountdown(WARNING_SECONDS);

        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
      },
      IDLE_TIMEOUT_MS - WARNING_SECONDS * 1000
    );

    logoutTimeoutRef.current = setTimeout(() => {
      performLogout();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimers, performLogout]);

  const continueSession = useCallback(() => {
    setIdleWarningOpen(false);
    setCountdown(WARNING_SECONDS);
    scheduleIdleTimers();
  }, [scheduleIdleTimers]);

  useEffect(() => {
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    const onActivity = () => {
      if (idleWarningOpen) {
        setIdleWarningOpen(false);
      }
      scheduleIdleTimers();
    };

    scheduleIdleTimers();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      clearIdleTimers();
    };
  }, [idleWarningOpen, scheduleIdleTimers, clearIdleTimers]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />

      {idleWarningOpen ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">
              Session Timeout Warning
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              You have been inactive.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              For security, your session will be destroyed and you will be
              logged out in <span className="font-semibold">{countdown}s</span>.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                onClick={continueSession}
              >
                Stay Logged In
              </button>
              <button
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/15"
                onClick={performLogout}
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-80 border-r border-sidebar-border bg-sidebar/95 p-4 shadow-2xl transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/organizer"
            className="flex items-center gap-3 text-sidebar-foreground"
          >
            <div className="relative h-10 w-10 overflow-hidden rounded-xl ring-1 ring-primary/30">
              <Image
                src="/logo.jpeg"
                alt="NimblyPolls logo"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">
                Organizer Lab
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-sidebar-foreground/70">
                NimblyPolls Control
              </p>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5 text-sidebar-foreground" />
          </button>
        </div>

        <div className="mb-6 rounded-3xl border border-sidebar-border bg-gradient-to-br from-sidebar-accent via-sidebar-accent/80 to-sidebar/80 p-4 shadow-lg shadow-black/10">
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
            <label className="group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-primary/30 bg-primary/10 shadow-xl ring-4 ring-primary/10 transition hover:scale-[1.02]">
              {profileImage ? (
                <Image
                  src={profileImage}
                  alt="Profile"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-sidebar-foreground">
                  {getInitials(userName)}
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

        <div className="mb-6 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-sidebar-foreground/70">
            Today snapshot
          </p>
          <p className="mt-2 text-xl font-semibold text-sidebar-foreground">
            Ready to launch
          </p>
          <p className="mt-1 text-xs text-sidebar-foreground/70">
            Keep your event analytics and media polished before publishing.
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-220px)] pr-1">
          <nav className="space-y-5">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="px-2 text-xs uppercase tracking-[0.2em] text-sidebar-foreground/55">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const active = activePath === item.href;

                  return (
                    <Link
                      key={`${group.title}-${item.label}`}
                      href={item.href}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4.5 w-4.5" />
                        {item.label}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 transition ${
                          active
                            ? 'opacity-90'
                            : 'opacity-0 group-hover:opacity-70'
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mt-8 border-t border-sidebar-border pt-4">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              onClick={performLogout}
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </ScrollArea>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-lg lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="h-6 w-6 text-foreground" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {header.eyebrow}
                </p>
                <h2 className="text-base font-semibold text-foreground md:text-lg">
                  {header.title}
                </h2>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Quick search
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground transition hover:border-primary/50"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground transition hover:border-primary/50"
                aria-label="Account"
              >
                <CircleUserRound className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
