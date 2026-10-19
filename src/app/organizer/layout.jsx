'use client';

import { Layout } from '@/components/layout/Layout';
import { OrganizerShell } from '@/components/organizer/OrganizerShell';
import { usePathname } from 'next/navigation';

export default function OrganizerLayout({ children }) {
  const pathname = usePathname();
  const isPublicOrganizerPage =
    pathname === '/organizer/register' || pathname === '/organizer/login';

  if (isPublicOrganizerPage) {
    return <Layout>{children}</Layout>;
  }

  return <OrganizerShell>{children}</OrganizerShell>;
}
