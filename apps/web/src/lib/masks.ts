/** Máscaras de input para uso em onChange. */

export function maskCelular(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}

/** Date input com máscara DD/MM/AAAA. */
export function maskData(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 8);
  if (v.length <= 2) return v;
  if (v.length <= 4) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
}

/** Converte DD/MM/AAAA → AAAA-MM-DD (formato esperado pelo backend). */
export function dataParaIso(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  // Sanity check de data válida
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}
