/**
 * Funções puras de formatação — zero dependências server-side.
 * Safe pra importar em client components sem puxar prisma/auth pro bundle.
 */

// TODO: falta tratar "ao", "em", "com" — por enquanto só pega as mais comuns
export function capitalizeName(name: string): string {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  const prepositions = ['de', 'do', 'da', 'dos', 'das', 'e'];

  return lower
    .split(' ')
    .map((word, index) => {
      if (index > 0 && prepositions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// mascara PII nas telas de listagem — o pessoal da recepção do prédio
// não precisa ver telefone/email completo do técnico, só o suficiente
// pra confirmar que é a pessoa certa. Na tela de detalhe mostra tudo.
export function maskPII<T>(data: T): T {
  const applyMask = (val: string): string => {
    if (!val || typeof val !== 'string') return val;
    if (val.includes('@')) {
      const [user, domain] = val.split('@');
      return `${user.charAt(0)}****@${domain}`;
    }
    // telefone: (11) 9****-1234
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 10) {
      const ddd = digits.substring(0, 2);
      const last4 = digits.substring(digits.length - 4);
      return `(${ddd}) 9****-${last4}`;
    }
    return val;
  };

  if (!data) return data;

  // Caso 1: String Pura (Uso na Interface)
  if (typeof data === 'string') return applyMask(data) as T;

  // Caso 2: Array de Objetos (Uso na API)
  if (Array.isArray(data)) {
    return data.map((item) => maskPII(item)) as T;
  }

  // Caso 3: Objeto (Uso na API) — recursivo pra pegar nested
  if (data instanceof Date) return data;
  if (typeof data === 'object') {
    const masked = { ...data } as Record<string, unknown>;
    if (masked.phone) masked.phone = applyMask(masked.phone as string);
    if (masked.email) masked.email = applyMask(masked.email as string);
    for (const key of Object.keys(masked)) {
      const val = masked[key];
      if (key !== 'phone' && key !== 'email' && val && typeof val === 'object') {
        masked[key] = maskPII(val);
      }
    }
    return masked as T;
  }

  return data;
}

export function formatPhone(value: string): string {
  if (!value) return '';
  let v = value.replace(/[^\d*]/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length <= 2) return v.length > 0 ? `(${v}` : v;
  if (v.length <= 7) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
  return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
}
