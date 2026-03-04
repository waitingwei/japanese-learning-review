import type { SRSFields } from '../types';

/**
 * Ebbinghaus-style forgetting curve: interval steps (index -> days until next review).
 * Again = step 0 (today). Good = +1 step. Easy = +2 steps.
 */
const INTERVAL_DAYS = [0, 1, 2, 4, 7, 14, 30] as const;
const MAX_STEP = INTERVAL_DAYS.length - 1;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Treat stored interval as step index; legacy data may have stored days, so clamp to max step. */
function stepFromPrev(prev: SRSFields): number {
  return Math.min(Math.max(0, prev.interval), MAX_STEP);
}

export type Rating = 'again' | 'good' | 'easy';

export function nextSRS(current: SRSFields | undefined, rating: Rating): SRSFields {
  const prev = current ?? {
    nextReviewAt: todayISO(),
    interval: 0,
    easeFactor: 2.5,
  };
  const today = todayISO();
  const currentStep = stepFromPrev(prev);
  let nextStep: number;
  if (rating === 'again') {
    nextStep = 0;
  } else if (rating === 'good') {
    nextStep = Math.min(currentStep + 1, MAX_STEP);
  } else {
    nextStep = Math.min(currentStep + 2, MAX_STEP);
  }
  const days = INTERVAL_DAYS[nextStep];
  const nextDate = days === 0 ? today : addDays(today, days);
  return {
    nextReviewAt: nextDate,
    interval: nextStep,
    easeFactor: prev.easeFactor,
  };
}

export function isDueToday(iso: string): boolean {
  return iso <= todayISO();
}
