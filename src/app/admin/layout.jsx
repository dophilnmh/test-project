import { AdminLayout } from '@/components/admin/AdminLayout';
import { ToastContainer } from 'react-toastify';
import { auth } from '@/app/auth';
import { redirect } from 'next/navigation';

export default async function AdminPageLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?next=/admin');
  }

  const role = session.user.role;
  if (role !== 'admin' && role !== 'superadmin') {
    redirect('/unauthorized');
  }

  return (
    <div>
      <ToastContainer />
      <AdminLayout>{children}</AdminLayout>
    </div>
  );
}
