import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { clearAdminToken, getAdminToken } from '@/lib/session';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const token = getAdminToken();
  if (!token) {
    redirect('/admin/login');
  }

  let me: { email: string } | null = null;
  try {
    me = await adminApi.me(token);
  } catch {
    redirect('/admin/login');
  }

  async function logout() {
    'use server';
    clearAdminToken();
    redirect('/admin/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row">
      <AdminSidebar email={me?.email ?? ''} logoutAction={logout} />
      <main className="flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
