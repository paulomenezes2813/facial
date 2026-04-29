import Link from 'next/link';
import { ShieldCheck, Settings, MonitorSmartphone } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-100">
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-16">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-sm">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Facial</h1>
            <p className="text-sm text-slate-500">Credenciamento por reconhecimento facial</p>
          </div>
        </div>

        <p className="text-slate-600 leading-relaxed">
          Sistema completo de pré-cadastro facial e check-in em totem para eventos.
        </p>

        <div className="grid gap-3">
          <Link
            href="/credenciamento"
            className="flex items-center gap-4 rounded-2xl bg-brand-500 px-5 py-4 font-semibold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600 hover:shadow-lg active:scale-[0.98]"
          >
            <ShieldCheck className="h-5 w-5 flex-none" />
            <div>
              <span className="block text-base">Cadastro do participante</span>
              <span className="block text-xs font-normal text-white/75">Preencha dados + 2 fotos</span>
            </div>
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow active:scale-[0.98]"
          >
            <Settings className="h-5 w-5 flex-none text-slate-400" />
            <div>
              <span className="block text-base">Painel administrativo</span>
              <span className="block text-xs text-slate-400">Gerenciar eventos e participantes</span>
            </div>
          </Link>
          <Link
            href="/totem"
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow active:scale-[0.98]"
          >
            <MonitorSmartphone className="h-5 w-5 flex-none text-slate-400" />
            <div>
              <span className="block text-base">Totem de check-in</span>
              <span className="block text-xs text-slate-400">Interface do quiosque</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
