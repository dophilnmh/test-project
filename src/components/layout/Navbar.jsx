'use client';

import Image from 'next/image';
import { Menu, UserCircle2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getRoleHome } from '@/lib/roleRedirect';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms' },
  { href: '/events', label: 'Tickets and Events' },
  { href: '/competitions', label: 'Competitions' },
  { href: '/shop', label: 'Shop' },
  { href: '/voting', label: 'Polls' },
  { href: '/blogs', label: 'Blogs' },
  { href: '/contact', label: 'Contact' },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const profileHref = session?.user?.role
    ? getRoleHome(session.user.role)
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="NimblyPolls logo"
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-primary/40"
            />
            <div>
              <p className="text-sm font-semibold tracking-wide text-foreground">
                NimblyPolls
              </p>
              <p className="text-xs text-muted-foreground">
                Polls, Events & Ticketing
              </p>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    active
                      ? 'text-primary'
                      : 'text-foreground/80 hover:text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {profileHref ? (
              <Link
                href={profileHref}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground/90 transition hover:text-primary"
              >
                <UserCircle2 className="h-4 w-4" />
                Profile
              </Link>
            ) : null}
          </div>

          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="lg:hidden rounded-md p-2 text-foreground hover:text-primary"
            aria-label="Open navigation"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border bg-card"
          >
            <div className="container mx-auto space-y-3 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block rounded-md py-2 text-sm font-medium ${
                    pathname === link.href
                      ? 'text-primary'
                      : 'text-foreground/80'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {profileHref ? (
                <Link
                  href={profileHref}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 rounded-md py-2 text-sm font-medium text-foreground/80"
                >
                  <UserCircle2 className="h-4 w-4" />
                  Profile
                </Link>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
