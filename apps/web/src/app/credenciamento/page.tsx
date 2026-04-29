export default function CredenciamentoIndex() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold">Credenciamento</h1>
      <p className="mt-2 text-sm text-slate-600">
        O acesso é feito por link único do evento, no formato:
      </p>
      <code className="mt-3 block rounded-lg bg-slate-100 px-3 py-2 text-sm">
        /credenciamento/&lt;ID-DO-EVENTO&gt;
      </code>
      <p className="mt-4 text-sm text-slate-500">
        Solicite o link ao organizador do evento para iniciar seu cadastro.
      </p>
    </main>
  );
}
