'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  Tags,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export function AdminSidebar({
  email,
  logoutAction,
}: {
  email: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [tipoUsoOpen, setTipoUsoOpen] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith('/admin/eventos')) {
      setTipoUsoOpen(true);
    }
  }, [pathname]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <p className="text-sm font-bold text-slate-900">Facial</p>
        </div>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">Facial</p>
              <p className="text-xs text-slate-500">Administração</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={close}
            className="rounded-lg p-1 text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2" onClick={close}>
          <SidebarLink href="/admin/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </SidebarLink>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-expanded={tipoUsoOpen}
              aria-controls="submenu-tipo-uso"
              onClick={(e) => {
                e.stopPropagation();
                setTipoUsoOpen((v) => !v);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-700',
                pathname?.startsWith('/admin/eventos') && 'bg-brand-50/80 text-brand-800'
              )}
            >
              <span className="flex items-center gap-2">
                <Tags className="h-4 w-4 shrink-0" />
                Tipo de Uso
              </span>
              <ChevronRight
                className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', tipoUsoOpen && 'rotate-90')}
                aria-hidden
              />
            </button>
            {tipoUsoOpen && (
              <div
                id="submenu-tipo-uso"
                className="ml-2 flex flex-col gap-0.5 border-l border-slate-200 py-0.5 pl-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href="/admin/eventos"
                  onClick={close}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    pathname?.startsWith('/admin/eventos')
                      ? 'bg-brand-100 text-brand-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <CalendarDays className="h-4 w-4 shrink-0 opacity-80" />
                  Eventos
                </Link>
              </div>
            )}
          </div>
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
        <form action={logoutAction} className="border-t border-slate-200 p-3">
          <p className="px-2 pb-2 text-xs text-slate-500">{email}</p>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </aside>
    </>
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
