import { describe, expect, it } from 'vitest';
import { count, countFull, drugCase, growth, money, moneyCents, moneyFull, monthLong, monthShort, pct, sum } from '../src/format';

describe('money', () => {
  it('formats billions to two decimals', () => {
    expect(money(2_690_000_000)).toBe('$2.69bn');
  });
  it('formats millions, dropping decimals above 100m', () => {
    expect(money(1_500_000)).toBe('$1.5m');
    expect(money(982_000_000)).toBe('$982m');
  });
  it('formats thousands', () => {
    expect(money(45_200)).toBe('$45.2k');
  });
  it('formats small amounts exactly', () => {
    expect(money(312)).toBe('$312');
  });
  it('handles zero', () => {
    expect(money(0)).toBe('$0');
  });
  it('handles negatives without losing the sign', () => {
    expect(money(-1_500_000)).toBe('$-1.5m');
  });
});

describe('moneyFull / moneyCents', () => {
  it('separates thousands', () => {
    expect(moneyFull(1234567)).toBe('$1,234,567');
  });
  it('always shows two decimals for per-script figures', () => {
    expect(moneyCents(1062.8)).toBe('$1,062.80');
    expect(moneyCents(4)).toBe('$4.00');
  });
});

describe('count', () => {
  it('compacts millions', () => {
    expect(count(92_200_000)).toBe('92.2m');
    expect(count(1_350_000)).toBe('1.4m');
  });
  it('drops the decimal above 100 million, where it is noise', () => {
    expect(count(582_400_000)).toBe('582m');
  });
  it('switches to billions rather than reporting "1880m"', () => {
    expect(count(1_880_000_000)).toBe('1.88bn');
  });
  it('compacts thousands', () => {
    expect(count(340_000)).toBe('340k');
  });
  it('leaves small numbers alone', () => {
    expect(count(812)).toBe('812');
    expect(count(0)).toBe('0');
  });
  it('separates thousands in the full form', () => {
    expect(countFull(1880000000)).toBe('1,880,000,000');
  });
});

describe('pct', () => {
  it('renders a fraction as a percentage', () => {
    expect(pct(0.593)).toBe('59%');
    expect(pct(0.593, 1)).toBe('59.3%');
  });
  it('handles the extremes', () => {
    expect(pct(0)).toBe('0%');
    expect(pct(1)).toBe('100%');
  });
});

describe('growth', () => {
  it('uses a multiple once something has at least doubled', () => {
    expect(growth(4344, 100)).toBe('43.4×');
  });
  it('uses a signed percentage below a doubling', () => {
    expect(growth(148, 100)).toBe('+48%');
    expect(growth(63, 100)).toBe('-37%');
  });
  it('calls out something with no prior activity', () => {
    expect(growth(500, 0)).toBe('new');
  });
  it('renders an em dash when there is nothing either side', () => {
    expect(growth(0, 0)).toBe('—');
  });
});

describe('month labels', () => {
  it('shortens for axes', () => {
    expect(monthShort('202603')).toBe('Mar 26');
  });
  it('spells out for tooltips', () => {
    expect(monthLong('202007')).toBe('July 2020');
  });
});

describe('sum', () => {
  const series = [1, 2, 3, 4, 5];
  it('sums the whole series by default', () => {
    expect(sum(series)).toBe(15);
  });
  it('sums a slice', () => {
    expect(sum(series, 1, 3)).toBe(5);
  });
  it('clamps out-of-range bounds instead of producing NaN', () => {
    expect(sum(series, -5, 99)).toBe(15);
    expect(sum(series, 3, 1)).toBe(0);
  });
  it('handles an empty series', () => {
    expect(sum([])).toBe(0);
  });
});

describe('drugCase', () => {
  it('title-cases a shouted generic name', () => {
    expect(drugCase('ROSUVASTATIN')).toBe('Rosuvastatin');
  });
  it('keeps combination separators readable', () => {
    expect(drugCase('GLECAPREVIR + PIBRENTASVIR')).toBe('Glecaprevir + Pibrentasvir');
  });
  it('lowercases joining words', () => {
    expect(drugCase('CALCIUM AND VITAMIN D')).toBe('Calcium and Vitamin D');
  });
});
