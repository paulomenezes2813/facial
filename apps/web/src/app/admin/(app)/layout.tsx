import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Activity, CalendarDays, LayoutDashboard, LogOut, QrCode, ShieldCheck, Tv, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { clearAdminToken, getAdminToken } from '@/lib/session';

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
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">Facial</p>
            <p className="text-xs text-slate-500">Administração</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          <SidebarLink href="/admin/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </SidebarLink>
          <SidebarLink href="/admin/eventos" icon={<CalendarDays className="h-4 w-4" />}>
            Eventos
          </SidebarLink>
          <SidebarLink href="/admin/participantes" icon={<Users className="h-4 w-4" />}>
            Participantes
          </SidebarLink>
          <SidebarLink href="/admin/totens" icon={<Tv className="h-4 w-4" />}>
            Totens
          </SidebarLink>
          <SidebarLink href="/admin/checkins" icon={<Activity className="h-4 w-4" />}>
            Check-ins
          </SidebarLink>
          <SidebarLink href="/admin/qrcode" icon={<QrCode className="h-4 w-4" />}>
            QR Code
          </SidebarLink>
        </nav>
        <form action={logout} className="border-t border-slate-200 p-3">
          <p className="px-2 pb-2 text-xs text-slate-500">{me?.email}</p>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  children,
}: {
  href: React.ComponentProps<typeof Link>['href'];
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
    >
      {icon}
      {children}
    </Link>
  );
}
