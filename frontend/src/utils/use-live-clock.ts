import { useEffect, useState } from 'react';

export function useLiveClock(): Date {
  const [time, setTime] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setTime(Date.now());
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return new Date(time);
}