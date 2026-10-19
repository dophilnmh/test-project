import { auth } from '@/app/auth';
import { redirect } from 'next/navigation';
import { getRoleHome } from '@/lib/roleRedirect';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  console.log('🚀 Dashboard page STARTING on Vercel');

  try {
    console.log('🔍 Fetching session...');
    const session = await auth();
    console.log('📊 Session received:', session);

    if (!session?.user) {
      console.log('❌ NO SESSION - Redirecting to login');
      redirect('/login');
    }

    console.log('✅ User found:', session.user.email);
    console.log('🎭 User role:', session.user.role);
    console.log('🎭 User name:', session.user.name);
    console.log('🎭 User ID:', session.user.id);

    const role = session.user.role;
    const destination = getRoleHome(role);
    console.log('🔄 Redirecting based on role:', role, destination);
    redirect(destination);
  } catch (error) {
    // Check if it's a redirect error - if so, re-throw it
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      console.log('🔄 This is a NEXT_REDIRECT - letting it through');
      throw error; // Let Next.js handle the redirect
    }

    console.error('💥 REAL Dashboard error:', error);
    console.error('💥 Error stack:', error.stack);
    console.error('💥 Error message:', error.message);
    redirect('/login?error=session_error');
  }

  return <div>Redirecting...</div>;
}
