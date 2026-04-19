/** Utilitários de data puros — sem dependências de negócio ou I/O. */

export const isWeekend = (date: Date): boolean => date.getUTCDay() === 0 || date.getUTCDay() === 6;

export const toDateKey = (date: Date): string => date.toISOString().split('T')[0];

export const getSaturdays = (year: number, month: number): Date[] => {
  const sats: Date[] = [];
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(Date.UTC(year, month, d));
    if (date.getUTCDay() === 6) sats.push(date);
  }
  return sats;
};
