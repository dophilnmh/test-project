import { redirect } from 'next/navigation';

export default function OrganizerLoginPage() {
  redirect('/login?next=/organizer');
}
