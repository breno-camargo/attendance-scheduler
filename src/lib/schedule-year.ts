export function annualScheduleWhere(year: number) {
  return {
    date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    status: { not: 'CANCELLED' as const },
  };
}
