import type { SRSFields } from '../types';

// Simple SM-2-like step: Again -> 0d, Good -> +1 interval, Easy -> +2
const MIN_INTERVAL = 0;
const GOOD_BONUS = 1;
const EASY_BONUS = 2;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Rating = 'again' | 'good' | 'easy';

export function nextSRS(current: SRSFields | undefined, rating: Rating): SRSFields {
  const prev = current ?? {
    nextReviewAt: todayISO(),
    interval: 0,
    easeFactor: 2.5,
  };
  const today = todayISO();
  let nextInterval: number;
  let nextDate: string;
  if (rating === 'again') {
    nextInterval = MIN_INTERVAL;
    nextDate = today;
  } else if (rating === 'good') {
    nextInterval = Math.max(1, prev.interval + GOOD_BONUS);
    nextDate = addDays(today, nextInterval);
  } else {
    nextInterval = Math.max(1, prev.interval + EASY_BONUS);
    nextDate = addDays(today, nextInterval);
  }
  return {
    nextReviewAt: nextDate,
    interval: nextInterval,
    easeFactor: prev.easeFactor,
  };
}

export function isDueToday(iso: string): boolean {
  return iso <= todayISO();
}
