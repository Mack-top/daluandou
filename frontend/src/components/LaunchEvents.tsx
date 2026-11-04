import { CalendarClock, Flame, Star } from 'lucide-react';
import { onArtworkError } from './GameUi';
import { compactNumber, countdownToMidnight, countdownToWeekEnd, launchEvents, type DialogName, type GameSave } from '../game-data';
import { useLiveClock } from '../utils/use-live-clock';

const marks = { gold: Star, coral: Flame, green: Star, blue: Star } as const;

export function LaunchEventsPanel({ save, onOpen }: { save: GameSave; onOpen: (dialog: DialogName) => void }) {
  const now = useLiveClock();
  return <div className="events-panel">
    <div className="estate-body">
      <p className="estate-copy">开服活动集中展示在这里。倒计时按本地日历演示，不会关闭活动入口；每日活动进度在午夜重置。</p>
      <div className="events-timer">
        <CalendarClock size={16} />
        <span>距离本地午夜 <strong>{countdownToMidnight(now)}</strong></span>
      </div>
      <ul className="events-list">{launchEvents.map(event => {
        const Mark = marks[event.tone];
        const until = event.until === 'midnight' ? `今日 ${countdownToMidnight(now)}`
          : event.until === 'week' ? `本周 ${countdownToWeekEnd(now)}`
          : '常驻展示';
        return <li key={event.id} className={`event-tone-${event.tone}`}>
          <span className="event-art-thumb"><img src={event.image} alt="" loading="lazy" decoding="async"  onError={onArtworkError} /><span className="event-mark"><Mark size={13} /></span></span>
          <span className="event-copy">
            <small>{event.english}</small>
            <strong>{event.name}</strong>
            <em>{event.detail}</em>
          </span>
          <span className="event-meta">
            <span className="event-until">{until}</span>
            <button className="claim-chip" onClick={() => onOpen(event.dialog)}>前往</button>
          </span>
        </li>;
      })}</ul>
      <p className="estate-note">活动倒计时按设备本地时钟计算 · 持有灵晶 {compactNumber(save.gems)} · 均为本地演示，不含真实付费</p>
    </div>
  </div>;
}
