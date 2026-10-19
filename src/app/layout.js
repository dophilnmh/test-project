import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from 'next-auth/react';
import { FloatingWhatsAppButton } from '@/components/layout/FloatingWhatsAppButton';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  metadataBase: new URL('https://nimblypolls.com'),
  title: 'NimblyPolls',
  description: 'Modern voting, events, and ticketing platform',
  applicationName: 'NimblyPolls',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'NimblyPolls',
    description: 'Modern voting, events, and ticketing platform',
    url: 'https://nimblypolls.com',
    siteName: 'NimblyPolls',
    type: 'website',
    images: [
      {
        url: '/logo.jpeg',
        width: 512,
        height: 512,
        alt: 'NimblyPolls logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NimblyPolls',
    description: 'Modern voting, events, and ticketing platform',
    images: ['/logo.jpeg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          {children}
          <FloatingWhatsAppButton />
        </SessionProvider>
      </body>
    </html>
  );
}
