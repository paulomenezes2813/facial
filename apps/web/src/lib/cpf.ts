/** Validador completo de CPF (incluindo dígitos verificadores). */
export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000.000.000-00, 111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);

  const calc = (slice: number[], factorStart: number): number => {
    const sum = slice.reduce((acc, d, i) => acc + d * (factorStart - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const dv1 = calc(digits.slice(0, 9), 10);
  if (dv1 !== digits[9]) return false;

  const dv2 = calc(digits.slice(0, 10), 11);
  return dv2 === digits[10];
}

export function maskCpf(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
