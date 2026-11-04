import { useEffect, useId, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { X } from 'lucide-react';
import { compactNumber, type ItemKind, type Reward } from '../game-data';

/** 美术文件缺失或加载失败时隐藏破图，露出容器自带的渐变氛围底。 */
export function onArtworkError(event: SyntheticEvent<HTMLImageElement, Event>): void {
  const image = event.currentTarget;
  image.style.visibility = 'hidden';
  image.closest('[data-art]')?.classList.add('art-missing');
}

export function Sigil({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M50 4 57 32 79 20 68 43 94 50 68 57 79 80 57 68 50 96 43 68 21 80 32 57 6 50 32 43 21 20 43 32Z" stroke="currentColor" strokeWidth="1" />
      <path d="m50 18 7 25 25 7-25 7-7 25-7-25-25-7 25-7Z" fill="currentColor" opacity=".85" />
      <circle cx="50" cy="50" r="33" stroke="currentColor" opacity=".5" />
      <circle cx="50" cy="50" r="6" fill="#121726" stroke="currentColor" />
    </svg>
  );
}

export function Ornament({ className = '' }: { className?: string }) {
  return <div className={`ornament ${className}`} aria-hidden="true"><span /><i /><b /><i /><span /></div>;
}

export function GoldButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`gold-button ${className}`}>
      <span className="button-flourish" aria-hidden="true" />
      <span>{children}</span>
      <span className="button-flourish mirrored" aria-hidden="true" />
    </button>
  );
}

export function BadgeDot({ count }: { count?: number }) {
  if (!count) return null;
  return <span className="badge-dot" aria-label={`${count} 项待处理`}>{count > 9 ? '9+' : count}</span>;
}

export function NavAction({ icon, label, onClick, className = '', badge }: { icon: ReactNode; label: string; onClick: () => void; className?: string; badge?: number }) {
  return <button type="button" className={`nav-action ${className}`} onClick={onClick}>
    <span className="nav-icon">{icon}<BadgeDot count={badge} /></span>
    <span>{label}</span>
  </button>;
}

export function Dialog({ title, subtitle, children, onClose, className = '', bare = false }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; className?: string; bare?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const initial = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
      (initial || ref.current)?.focus();
    });
    // Keep keyboard navigation inside the single active dialog.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab' || !ref.current) return;
      const elements = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(element => element.offsetParent !== null);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`game-dialog ${bare ? 'bare-dialog' : 'parchment-dialog'} ${className}`}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭弹窗"><X size={23} strokeWidth={1.5} /></button>
        {bare ? <h2 className="sr-only" id={titleId}>{title}</h2> : (
          <header className="dialog-heading">
            <Sigil className="dialog-sigil" />
            {subtitle && <p className="eyebrow">{subtitle}</p>}
            <h2 id={titleId}>{title}</h2>
            <Ornament />
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

export function ItemArt({ kind, image, className = '' }: { kind: ItemKind; image?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  if (kind === 'character' && image) return <img src={image} alt="" className={`item-portrait ${className}`} onError={onArtworkError} />;
  return (
    <svg className={`item-art ${className}`} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="12" y1="10" x2="65" y2="70" gradientUnits="userSpaceOnUse"><stop stopColor="#fff6b0" /><stop offset=".45" stopColor="#efbe54" /><stop offset="1" stopColor="#ac6c20" /></linearGradient>
        <linearGradient id={`${id}-blue`} x1="20" y1="10" x2="60" y2="70" gradientUnits="userSpaceOnUse"><stop stopColor="#d5ffff" /><stop offset=".4" stopColor="#59d7ff" /><stop offset="1" stopColor="#1856c4" /></linearGradient>
        <linearGradient id={`${id}-purple`} x1="20" y1="10" x2="60" y2="70" gradientUnits="userSpaceOnUse"><stop stopColor="#e8c3ff" /><stop offset=".5" stopColor="#aa70db" /><stop offset="1" stopColor="#65409f" /></linearGradient>
      </defs>
      {kind === 'gem' && <>
        <path d="m39 7 18 8 7 19-13 16-23-3-9-20Z" fill={`url(#${id}-blue)`} stroke="#d3f8ff" />
        <path d="m39 7 2 20 16-12M41 27l23 7-13 16-10-23-13 20M19 27h22" stroke="#d7ffff" strokeOpacity=".8" />
        <path d="m19 34 16 6 6 16-11 14-19-3-6-17Z" fill={`url(#${id}-blue)`} stroke="#c2faff" />
        <path d="m19 34 3 18 13-12M22 52l19 4M22 52l8 18M5 50l17 2-11 15" stroke="#a6f0ff" />
        <path d="m54 43 15 6 5 14-11 12-16-4-5-15Z" fill={`url(#${id}-blue)`} stroke="#a2f3ff" /><path d="m54 43 3 17 12-11M57 60l17 3M57 60l6 15" stroke="#d3ffff" />
      </>}
      {kind === 'book' && <>
        <path d="m25 11 41 8-12 55-42-9Z" fill="#352447" stroke={`url(#${id}-gold)`} strokeWidth="3" />
        <path d="m27 8 38 8-11 51-38-8Z" fill={`url(#${id}-purple)`} stroke="#e9c383" strokeWidth="2" />
        <path d="m29 17 27 6-7 34-27-6Z" stroke="#eac4ee" />
        <path d="m40 28 3 10 10 5-11 2-6 9-2-11-9-5 11-2Z" fill="#fbe4a3" />
        <path d="m27 9-12-5 2 11 8 7M60 16l14-5-4 12-12 3" fill="#f5e8ff" stroke="#bda2da" />
      </>}
      {kind === 'coin' && <>
        <ellipse cx="46" cy="58" rx="23" ry="12" fill="#b57823" stroke="#f6d273" /><ellipse cx="46" cy="53" rx="23" ry="12" fill={`url(#${id}-gold)`} stroke="#fff1a6" />
        <ellipse cx="45" cy="47" rx="23" ry="12" fill={`url(#${id}-gold)`} stroke="#fff1a6" />
        <ellipse cx="31" cy="35" rx="23" ry="28" transform="rotate(20 31 35)" fill={`url(#${id}-gold)`} stroke="#fff2b5" strokeWidth="2" />
        <ellipse cx="31" cy="35" rx="17" ry="22" transform="rotate(20 31 35)" stroke="#a86a21" strokeWidth="2" /><path d="m30 23 7 4-10 18M26 28l7-5M24 42l8 3" stroke="#98621e" strokeWidth="4" strokeLinecap="round" />
      </>}
      {kind === 'potion' && <>
        <path d="m34 14 18 5-5 16c20 13 15 35-5 39C18 78 5 51 27 35Z" fill={`url(#${id}-blue)`} stroke="#c1eaff" strokeWidth="2" />
        <path d="M22 50c8-6 20 7 34 0 6 14-6 23-16 22-11 0-20-9-18-22Z" fill="#2864cc" opacity=".75" />
        <path d="m35 6 21 5-3 14-22-6Z" fill={`url(#${id}-gold)`} stroke="#ffedac" strokeWidth="2" />
        <path d="m31 23 19 5M26 43c-5 3-8 9-7 13" stroke="#e9fbff" strokeWidth="4" strokeLinecap="round" /><circle cx="48" cy="58" r="3" fill="#b3edff" />
      </>}
      {kind === 'leaf' && <>
        <path d="m20 19 46-9-9 55-44 9Z" fill="#267a61" stroke="#b4e8ad" strokeWidth="2" /><path d="m23 15 46-8-11 11-37 8Z" fill="#cef1c7" />
        <path d="M52 25C22 13 18 45 42 43c-17 9-20 20-14 27 5-13 27-17 31-30 2-7-1-12-7-15Z" fill={`url(#${id}-gold)`} stroke="#ffe6a6" /><path d="M41 31c11-1 8 9-1 11" stroke="#748b44" strokeWidth="3" />
      </>}
      {kind === 'chest' && <>
        <path d="m9 35 31-11 31 12-3 29-28 10-28-10Z" fill="#76509d" stroke={`url(#${id}-gold)`} strokeWidth="3" /><path d="m10 35 30 12 31-11M40 47v28" stroke="#f3d896" strokeWidth="3" />
        <path d="M11 34c-3-18 14-26 29-27 16 1 33 11 30 28L40 46Z" fill="#463765" stroke={`url(#${id}-gold)`} strokeWidth="3" /><path d="M40 8v37M25 10c-9 8-10 16-9 25M55 12c8 9 10 16 8 23" stroke="#dfbc74" strokeWidth="3" /><path d="m32 43 8-3 8 3v13l-8 4-8-4Z" fill={`url(#${id}-gold)`} /><path d="m40 44 4 5-4 7-4-7Z" fill="#a74cd6" />
      </>}
      {kind === 'medal' && <>
        <path d="m39 7 8 14 16-7-2 18 14 9-13 11 1 17-17-6-7 12-9-13-17 6 2-17L4 40l14-8-2-19 16 8Z" fill="#c2cddc" stroke="#f3f6ff" strokeWidth="2" /><path d="m39 20 20 13-5 24-15 11-16-12-5-23Z" fill="#637da8" stroke="#e4f4ff" strokeWidth="2" /><path d="m39 27 12 12-4 16-8 7-10-10-2-14Z" fill={`url(#${id}-purple)`} stroke="#f8c7ff" /><path d="m39 27 1 22 11-10M40 49l-1 13-12-24" stroke="#f3c8ff" />
      </>}
      {kind === 'exp' && <>
        <rect x="14" y="54" width="52" height="12" rx="6" fill="#463765" stroke="#e9c383" strokeWidth="2" />
        <rect x="18" y="58" width="32" height="4" rx="2" fill={`url(#${id}-gold)`} />
        <path d="m40 10 17 19h-10v15h-14V29h-10Z" fill={`url(#${id}-gold)`} stroke="#ffedac" strokeWidth="2" />
      </>}
    </svg>
  );
}

export function RewardTile({ reward, small = false }: { reward: Reward; small?: boolean }) {
  return <div className={`reward-tile ${small ? 'small-reward' : ''}`}>
    <div className={`reward-frame rarity-${reward.kind}`}><ItemArt kind={reward.kind} image={reward.image} /><span className="reward-amount">{compactNumber(reward.amount)}</span></div>
    <span className="reward-name">{reward.label}</span>
  </div>;
}

export function Rewards({ items, small = false }: { items: Reward[]; small?: boolean }) {
  return <div className="rewards">{items.map((reward, i) => <RewardTile key={`${reward.kind}-${i}`} reward={reward} small={small} />)}</div>;
}

export function Particles() {
  return <div className="particles" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => (
    <i key={index} style={{ '--x': `${(index * 37 + 7) % 100}%`, '--y': `${(index * 23 + 11) % 100}%`, '--delay': `${(index % 6) * -1.7}s`, '--duration': `${8 + index % 5}s` } as CSSProperties} />
  ))}</div>;
}