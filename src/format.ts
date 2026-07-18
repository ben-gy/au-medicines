/** Compact dollars: $1.35bn, $982m, $45.2k, $312. */
export function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}m`;
  if (abs >= 1e4) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

/** Exact dollars with separators, no cents: $1,234,567. */
export function moneyFull(n: number): string {
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

/** Dollars with cents, for per-script figures: $1,062.88. */
export function moneyCents(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact counts: 1.88bn, 92.2m, 1.35m, 340k, 812. */
export function count(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}m`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  return Math.round(n).toLocaleString('en-AU');
}

export function countFull(n: number): string {
  return Math.round(n).toLocaleString('en-AU');
}

export function pct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/**
 * Growth between two periods as a human-readable multiple or percentage.
 * Returns "new" when there is no prior activity to compare against.
 */
export function growth(current: number, prior: number): string {
  if (prior <= 0) return current > 0 ? 'new' : '—';
  const ratio = current / prior;
  if (ratio >= 2) return `${ratio.toFixed(1)}×`;
  const change = (ratio - 1) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
}

/** "202503" → "Mar 2026"-style label used on axes. */
export function monthShort(ym: string): string {
  const m = Number(ym.slice(4, 6));
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${ym.slice(2, 4)}`;
}

export function monthLong(ym: string): string {
  const m = Number(ym.slice(4, 6));
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[m - 1]} ${ym.slice(0, 4)}`;
}

/** Sum a slice of a series, used for the rolling 12-month windows. */
export function sum(values: number[], from = 0, to = values.length): number {
  let t = 0;
  for (let i = Math.max(0, from); i < Math.min(values.length, to); i++) t += values[i];
  return t;
}

/** Title Case a SHOUTED generic drug name, preserving separators like "(&)" and "+". */
export function drugCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bWith\b/g, 'with');
}
