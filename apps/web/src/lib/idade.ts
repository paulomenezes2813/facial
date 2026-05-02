/** Idade em anos completos, com base em data AAAA-MM-DD (nascimento). */
export function idadeAnosCompletos(dataNascimentoIso: string): number {
  const [y, m, d] = dataNascimentoIso.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}
