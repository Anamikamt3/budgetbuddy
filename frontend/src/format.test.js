import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  barClass, currentMonth, formatDate, formatMoney, greetingFor,
  initialsFor, monthLabel, shortMonth, timeAgo, todayISO,
} from './format.js';

afterEach(() => vi.restoreAllMocks());

describe('formatMoney', () => {
  it('shows two decimals and a thousands separator', () => {
    expect(formatMoney(1500, 'USD')).toMatch(/1,500\.00/);
  });

  it('treats text that is not a number as zero', () => {
    expect(formatMoney('abc', 'USD')).toMatch(/0\.00/);
  });

  it('falls back to plain text for an invalid currency code', () => {
    expect(formatMoney(5, 'NOT-A-CURRENCY')).toBe('NOT-A-CURRENCY 5.00');
  });
});

describe('dates', () => {
  it('formats a date', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026');
  });

  it('labels a month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(shortMonth('2026-10')).toBe('Oct 26');
  });

  it('gives today and the current month in the format the API expects', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('initialsFor', () => {
  it('uses the first letters of the full name', () => {
    expect(initialsFor('Anamika Menon', 'anu')).toBe('AM');
  });

  it('uses one letter for a single name', () => {
    expect(initialsFor('Anamika', 'anu')).toBe('A');
  });

  it('uses the username when there is no name', () => {
    expect(initialsFor('', 'anu')).toBe('AN');
  });
});

describe('barClass', () => {
  it('is normal, then warns at 80 percent, then turns red at 100', () => {
    expect(barClass(50)).toBe('');
    expect(barClass(80)).toBe('warn');
    expect(barClass(99.9)).toBe('warn');
    expect(barClass(100)).toBe('over');
    expect(barClass(150)).toBe('over');
  });
});

describe('greetingFor', () => {
  it('changes with the time of day', () => {
    const hours = vi.spyOn(Date.prototype, 'getHours');
    hours.mockReturnValue(9);
    expect(greetingFor('Anu')).toBe('Good morning, Anu');
    hours.mockReturnValue(14);
    expect(greetingFor('Anu')).toBe('Good afternoon, Anu');
    hours.mockReturnValue(20);
    expect(greetingFor('Anu')).toBe('Good evening, Anu');
  });
});

describe('timeAgo', () => {
  const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString();

  it('describes recent times in words', () => {
    expect(timeAgo(ago(10))).toBe('Just now');
    expect(timeAgo(ago(5 * 60))).toBe('5 minutes ago');
    expect(timeAgo(ago(60 * 60))).toBe('1 hour ago');
    expect(timeAgo(ago(3 * 24 * 3600))).toBe('3 days ago');
  });
});