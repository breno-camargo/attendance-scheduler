/**
 * Calcula a data da Páscoa para um dado ano (algoritmo de Meeus/Jones/Butcher).
 * Retorna { month, day } (0-indexed month para consistência com Date).
 */
function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day }; // 0-indexed month
}

/** Gera a lista de feriados nacionais + estaduais (SP) para qualquer ano. */
export function getHolidaysForYear(year: number): { date: string; name: string }[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (m: number, d: number) => `${year}-${pad(m + 1)}-${pad(d)}`;

  // Páscoa e feriados móveis derivados
  const e = easter(year);
  const easterDate = new Date(Date.UTC(year, e.month, e.day));
  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };

  const carnaval1 = addDays(easterDate, -48); // segunda de carnaval
  const carnaval2 = addDays(easterDate, -47); // terça de carnaval
  const sextaSanta = addDays(easterDate, -2);
  const corpusChristi = addDays(easterDate, 60);

  const fmtDate = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  return [
    { date: fmt(0, 1), name: 'Confraternização Universal' },
    { date: fmt(0, 25), name: 'Aniversário de São Paulo' },
    { date: fmtDate(carnaval1), name: 'Carnaval' },
    { date: fmtDate(carnaval2), name: 'Carnaval' },
    { date: fmtDate(sextaSanta), name: 'Paixão de Cristo' },
    { date: fmt(3, 21), name: 'Tiradentes' },
    { date: fmt(4, 1), name: 'Dia do Trabalho' },
    { date: fmtDate(corpusChristi), name: 'Corpus Christi' },
    { date: fmt(6, 9), name: 'Revolução Constitucionalista de 1932' },
    { date: fmt(8, 7), name: 'Independência do Brasil' },
    { date: fmt(9, 12), name: 'Nossa Senhora Aparecida' },
    { date: fmt(10, 2), name: 'Finados' },
    { date: fmt(10, 15), name: 'Proclamação da República' },
    { date: fmt(10, 20), name: 'Dia da Consciência Negra' },
    { date: fmt(11, 25), name: 'Natal' },
  ];
}
