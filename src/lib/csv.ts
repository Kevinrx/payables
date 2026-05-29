// Shared CSV primitives used by every export (aging, payments, …).
// One place for RFC-4180 escaping and cents→dollars so a fix (e.g. formula
// injection, \r\n handling) reaches all exporters at once.

export function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function centsToDollars(cents: string | number): string {
  return (Number(cents) / 100).toFixed(2);
}
