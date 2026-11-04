import { countdownFromHours, countdownToMidnight, elapsedDays } from '../game-data';
import { useLiveClock } from '../utils/use-live-clock';

export function MidnightCountdown() {
  const now = useLiveClock();
  return <time>{countdownToMidnight(now)}</time>;
}

export function SevenDayCountdown({ createdAt }: { createdAt?: string }) {
  const now = useLiveClock();
  const days = Math.min(7, elapsedDays(createdAt));
  return <time>{countdownFromHours(24 * (8 - days), now)}</time>;
}