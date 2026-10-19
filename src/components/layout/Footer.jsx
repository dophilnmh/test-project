'use client';

import Link from 'next/link';
import Image from 'next/image';

const eastAfricanFlags = [
  { country: 'Burundi', code: 'bi' },
  { country: 'Comoros', code: 'km' },
  { country: 'Djibouti', code: 'dj' },
  { country: 'DR Congo', code: 'cd' },
  { country: 'Eritrea', code: 'er' },
  { country: 'Ethiopia', code: 'et' },
  { country: 'Kenya', code: 'ke' },
  { country: 'Rwanda', code: 'rw' },
  { country: 'Seychelles', code: 'sc' },
  { country: 'Somalia', code: 'so' },
  { country: 'South Sudan', code: 'ss' },
  { country: 'Tanzania', code: 'tz' },
  { country: 'Uganda', code: 'ug' },
];

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/70">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <Image
                src="/logo.jpeg"
                alt="NimblyPolls logo"
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl object-cover ring-1 ring-primary/40"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  NimblyPolls
                </p>
                <p className="text-xs text-muted-foreground">
                  Polls, Events & Ticketing
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Run polls, launch events, sell tickets, and manage approvals in
              one secure platform. Organizers create, admins verify, and the
              public discovers trusted experiences.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-primary">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-primary"
                >
                  About NimblyPolls
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-primary"
                >
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted-foreground hover:text-primary"
                >
                  Public Events
                </Link>
              </li>
              <li>
                <Link
                  href="/organizer"
                  className="text-muted-foreground hover:text-primary"
                >
                  Organizer Panel
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-primary"
                >
                  Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-primary">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/contact"
                  className="text-muted-foreground hover:text-primary"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="mailto:nimblypolls@gmail.com"
                  className="hover:text-primary"
                >
                  Info@nimblypolls.com
                </a>
              </li>
              <li>West End Towers, Waiyaki Way, Nairobi</li>
              <li>Mega Plaza, Oginga Odinga Street, Kisumu</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border/70 bg-background/40 px-4 py-4">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Providing Services To
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
            {eastAfricanFlags.map(({ country, code }) => (
              <span
                key={country}
                className="flex flex-col items-center gap-2 rounded-xl border border-primary/20 bg-card px-2 py-3 text-center"
                title={country}
                aria-label={country}
              >
                <Image
                  src={`https://flagcdn.com/w80/${code}.png`}
                  alt={country}
                  width={44}
                  height={32}
                  className="h-8 w-11 rounded-sm object-cover shadow-sm sm:h-9 sm:w-12"
                />
                <span className="text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">
                  {country}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            Developed by{' '}
            <a
              href="https://wa.me/254725968323"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:text-primary/80"
            >
              Dati Softwares
            </a>
          </p>
          <p>© {new Date().getFullYear()} NimblyPolls. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
