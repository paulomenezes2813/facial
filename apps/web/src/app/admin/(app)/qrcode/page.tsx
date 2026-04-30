import { QrCode } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { requireAdminToken } from '@/lib/session';
import { EventQrCode } from '@/components/admin/EventQrCode';

export default async function AdminQrCodePage() {
  const token = requireAdminToken();
  const eventos = await adminApi.events.list(token);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <QrCode className="h-6 w-6 text-slate-600" />
            QR Code
          </h1>
          <p className="text-sm text-slate-500">Gere um QR Code para o credenciamento por evento.</p>
        </div>
      </header>

      <EventQrCode
        eventos={eventos.map((e) => ({ id: e.id, nome: e.nome }))}
        baseUrl={process.env.NEXT_PUBLIC_BASE_URL}
      />
    </div>
  );
}

