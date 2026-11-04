import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { ArrowRight, Check, ChevronRight, Dice5, Eye, Mars, Music2, ShieldCheck, Sparkles, Star, Trophy, UserRound, Venus, Volume2 } from 'lucide-react';
import { artwork, characters, compactNumber, featureScreens, previewScreens, type GameSave, type Preferences, type Profile } from '../game-data';
import { fetchServerStats, type ServerStat } from '../api/servers';
import { apiUrl } from '../api/base';
import { GoldButton, ItemArt, Ornament, Sigil, onArtworkError } from './GameUi';

export function ServerPanel({ save, onSelect }: { save: GameSave; onSelect: (number: number) => void }) {
  const [tab, setTab] = useState('recommend');
  // v16 按服隔离：状态来自 GET /api/servers 实时统计；接口不可用时降级为本地展示（不阻塞选服）
  const [stats, setStats] = useState<ServerStat[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchServerStats().then(result => { if (alive) setStats(result); });
    return () => { alive = false; };
  }, []);

  const statOf = (number: number): ServerStat | undefined => stats?.find(row => row.server === number);
  const isMaintenance = (number: number): boolean => statOf(number)?.maintenance ?? number === 8;
  const dotOf = (number: number): string => statOf(number)?.status ?? (number > 12 ? 'online' : 'busy');
  const subtitleOf = (number: number): string => {
    const stat = statOf(number);
    if (stat?.maintenance) return '维护中';
    if (stat) return number === save.server ? '当前服务器' : `${stat.players} 位旅者在本服`;
    return number === 17 ? '推荐 · 新的冒险' : number === 8 ? '维护中' : number === save.server ? '当前服务器' : '灵界大陆';
  };
  const recommendServers = stats
    ? [...stats].filter(row => !row.maintenance).sort((a, b) => b.players - a.players || a.server - b.server).slice(0, 6).map(row => row.server)
    : [17, 18, 16, 15, 14, 13];
  const servers = tab === 'recommend' ? recommendServers : tab === 'existing' ? save.profile ? [save.server] : [] : Array.from({ length: 18 }, (_, i) => i + 1);
  return <div className="server-panel">
    <div className="server-legend"><span><i className="status-dot busy" />热闹</span><span><i className="status-dot online" />顺畅</span><span><i className="status-dot offline" />维护</span></div>
    <div className="server-layout"><div className="server-tabs" role="tablist" aria-label="服务器分区">{[['recommend', '推荐服务器'], ['existing', '已有角色'], ['all', '食灵一区']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<ChevronRight size={14} /></button>)}</div>
      <div className="server-grid">{servers.length ? servers.map(number => <button key={number} className={`server-option ${save.server === number ? 'selected' : ''}`} disabled={isMaintenance(number)} onClick={() => onSelect(number)}><i className={`status-dot ${dotOf(number)}`} /><span>食灵 {number} 服<small>{subtitleOf(number)}</small></span>{number === save.server ? <Check size={16} /> : <ChevronRight size={15} />}</button>) : <div className="empty-state"><UserRound size={34} /><p>还没有与你缔结契约的角色</p><span>先选择一个服务器，开始你的冒险吧。</span></div>}</div>
    </div><p className="panel-note">当前服务器：食灵 {save.server} 服 <span>{stats ? '玩家数为服务器实时统计' : '离线模式 · 显示本地缓存状态'}</span></p>
  </div>;
}

export function NoticePanel() {
  return <article className="notice-content">
    <p className="notice-date">灵界纪事 · 开服特别篇</p>
    <h3>亲爱的命运之子：</h3>
    <p>时空之门今日正式开启，欢迎来到灵界大陆！当平凡的美食化为拥有灵魂的伙伴，一段关于相遇、守护与成长的故事，正等待你亲手书写。</p>
    <p>强大的食神为何消失不见？封印的力量为何再度苏醒？与食灵携手，穿越迷雾，寻找属于你们的答案。</p>
    <h3><span>01</span> 初入灵界，遇见同行者</h3>
    <p>创建角色即可获得 <strong>10 份食灵契约</strong>，前往召唤之门，结识第一批冒险伙伴。你也可以在食灵图鉴中了解他们的故事。</p>
    <h3><span>02</span> 七日之约，不负相遇</h3>
    <p>每日登录领取成长资源，次日可结识五星食灵 <strong>冬阴功</strong>，第七日更有 <strong>拉菲</strong> 与你相伴。每份赠礼，都为你的成长而来。</p>
    <h3><span>03</span> 星夜赠礼，为你闪耀</h3>
    <p>首充礼遇带来五星群攻食灵 <strong>蓝纹奶酪</strong>，与三日成长赠礼。契约特惠、等级礼包与每日礼遇，也可在主城中查看。</p>
    <aside className="notice-disclaimer"><ShieldCheck size={20} /><p>本地优先的完整体验：进度保存在当前浏览器，登录云端后自动同步至服务器；充值与支付为沙箱演示，不产生真实扣款。</p></aside>
    <p className="notice-signature">愿每一次相遇，都有值得回味的滋味。<br /><strong>食灵月城 · 灵界事务所</strong></p>
  </article>;
}

export function CreatePanel({ profile, onCreate }: { profile: Profile | null; onCreate: (name: string, gender: 'male' | 'female') => void }) {
  const [name, setName] = useState(profile?.name || '');
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'male');
  const [error, setError] = useState('');
  const [randomIndex, setRandomIndex] = useState(0);
  const names = ['星野拾味', '月下茶客', '奶酪旅人', '青团小筑', '桂花知己', '拾光旅人'];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[\p{L}\p{N}]{2,8}$/u.test(name.trim())) { setError('请输入 2 至 8 位中文、字母或数字。'); return; }
    onCreate(name.trim(), gender);
  };
  return <div className="create-layout"><div className="create-illustration"><img src={artwork.lobby} alt="食灵青团在翡翠茶庭等待与你相遇"  onError={onArtworkError} /><div><p>QING TUAN</p><h3>青团</h3><span>春山的来信</span></div></div>
    <form className="create-form" onSubmit={submit}><Sigil className="create-sigil" /><p className="eyebrow">THE BEGINNING OF YOUR STORY</p><h2>{profile ? '续写你的故事' : '初识灵界'}</h2><Ornament /><p className="create-welcome">每一个灵界生灵，都有自己的名字。<br />命运之子，我该如何称呼你？</p>
      <fieldset className="gender-picker"><legend>选择旅者形象</legend><button type="button" aria-pressed={gender === 'male'} onClick={() => setGender('male')}><Mars size={20} /> 少年{gender === 'male' && <Check size={14} />}</button><button type="button" aria-pressed={gender === 'female'} onClick={() => setGender('female')}><Venus size={20} /> 少女{gender === 'female' && <Check size={14} />}</button></fieldset>
      <label className="name-label" htmlFor="traveler-name">你的名字</label><div className={`name-input ${error ? 'has-error' : ''}`}><input id="traveler-name" data-autofocus value={name} maxLength={8} placeholder="写下你的旅者之名" autoComplete="off" aria-describedby="name-hint" aria-invalid={!!error} onChange={event => { setName(event.target.value); setError(''); }} /><button type="button" aria-label="随机名字" title="随机名字" onClick={() => { setName(names[randomIndex % names.length]); setRandomIndex(randomIndex + 1); setError(''); }}><Dice5 size={23} /></button></div>
      <p id="name-hint" className={`input-hint ${error ? 'error-text' : ''}`}>{error || '2 至 8 位中文、字母或数字'}</p><GoldButton type="submit">{profile ? '保存旅者信息' : '开启我的故事'}<ArrowRight size={17} /></GoldButton><p className="panel-note centered">旅者信息仅保存在当前浏览器</p>
    </form></div>;
}

export function GuidePanel({ name, onFinish, onSkip }: { name: string; onFinish: () => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: '欢迎来到灵界大陆', text: `${name}，很高兴在这里遇见你。我是青团，你在灵界的第一位朋友。这里的每一道美食，都藏着一个独一无二的灵魂。` },
    { title: '与食灵缔结契约', text: '灵界的平静正被未知的力量打破。我们需要更多伙伴的帮助。你已经获得 10 份食灵契约，可以前往召唤之门，邂逅新的伙伴。' },
    { title: '让故事，从相遇开始', text: '每天来看看七日之约，就能领取成长赠礼。在食灵图鉴中了解伙伴，在行囊中查看收获。准备好了吗？我们一起出发吧！' },
  ];
  return <div className="guide-layout"><div className="guide-avatar"><img src={artwork.lobby} alt="青团"  onError={onArtworkError} /></div><div className="guide-copy"><p className="eyebrow">A NOTE FROM QING TUAN <span>0{step + 1} / 03</span></p><p className="guide-name">青团 <small>你的灵界引路人</small></p><h2>{steps[step].title}</h2><p className="guide-text">{steps[step].text}</p><div className="guide-bottom"><button className="text-button" onClick={onSkip}>跳过引导</button><div className="step-dots">{steps.map((_, i) => <i key={i} className={step === i ? 'active' : ''} />)}</div><GoldButton onClick={() => step < 2 ? setStep(step + 1) : onFinish()}>{step < 2 ? '继续聆听' : '前往召唤'}<ArrowRight size={16} /></GoldButton></div></div></div>;
}

export function SettingsPanel({ preferences, setPreferences }: { preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>> }) {
  return <div className="settings-panel"><h3 className="setting-section-title">声 音</h3><div className="setting-row"><div><Music2 size={20} /><span>背景音乐<small>轻柔的灵界氛围音</small></span></div><button className="toggle" role="switch" aria-label="背景音乐" aria-checked={preferences.music} onClick={() => setPreferences(p => ({ ...p, music: !p.music }))}><i /></button></div><div className="setting-row"><div><Volume2 size={20} /><span>音乐音量</span></div><div className="volume-control"><input type="range" min="0" max="100" value={preferences.volume} aria-label="音乐音量" onChange={event => setPreferences(p => ({ ...p, volume: Number(event.target.value) }))} /><span>{preferences.volume}%</span></div></div>
    <h3 className="setting-section-title">画 面</h3><div className="setting-row"><div><Sparkles size={20} /><span>灵光粒子<small>营造轻盈的魔法氛围</small></span></div><button className="toggle" role="switch" aria-label="灵光粒子" aria-checked={preferences.particles} onClick={() => setPreferences(p => ({ ...p, particles: !p.particles }))}><i /></button></div><div className="setting-row theme-setting"><div><Eye size={20} /><span>界面色调</span></div><div className="theme-options">{[['moon', '月夜蓝'], ['jade', '翡翠绿'], ['amber', '琥珀金']].map(([key, label]) => <button key={key} className={`theme-option ${key}`} aria-pressed={preferences.theme === key} onClick={() => setPreferences(p => ({ ...p, theme: key as Preferences['theme'] }))}><i />{label}{preferences.theme === key && <Check size={12} />}</button>)}</div></div><p className="panel-note centered">偏好会自动保存在当前浏览器 · UI DEMO 1.0</p></div>;
}

/** v16：榜单标签与后端 leaderboard_defs 的真实映射（战力/胜场/世界树，全部来自服务端真实指标）。 */
const RANKING_BOARDS = [
  { id: 'lb-power', tab: '战力榜', metric: '综合战力', compact: true },
  { id: 'lb-battle-wins', tab: '胜场榜', metric: '累计胜场', compact: false },
  { id: 'lb-worldtree', tab: '冒险榜', metric: '世界树等级', compact: false },
] as const;

type RankingBoard = {
  id: string;
  name: string;
  entries: Array<{ rank: number; player_id: string; nickname: string | null; score: number }>;
};

export function RankingPanel({ save }: { save: GameSave }) {
  const [tab, setTab] = useState(0);
  // v16 按服隔离：榜单来自 /api/leaderboards?server=N（真实玩家、按服独立名次）；
  // 接口不可用时降级为离线提示，绝不展示编造的名次。
  const [boards, setBoards] = useState<RankingBoard[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/leaderboards?server=${save.server}`))
      .then(response => (response.ok ? response.json() : null))
      .then(payload => {
        if (!alive) return;
        const list = payload?.data?.leaderboards;
        setBoards(Array.isArray(list) ? list : null);
      })
      .catch(() => { if (alive) setBoards(null); });
    return () => { alive = false; };
  }, [save.server]);

  const board = boards?.find(item => item.id === RANKING_BOARDS[tab].id);
  const rows = board?.entries ?? [];
  return <div className="ranking-panel"><div className="simple-tabs" role="tablist" aria-label="排行榜类型">{RANKING_BOARDS.map((item, i) => <button key={item.id} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{item.tab}</button>)}</div><p className="leaderboard-caption">排名<span>旅者</span><span>{RANKING_BOARDS[tab].metric}</span></p><ol className="ranking-list">{rows.length ? rows.map((row, i) => {
    const rank = Number(row.rank);
    const avatar = characters[i % characters.length];
    return <li key={row.player_id}><span className={`rank-number rank-${Math.min(Math.max(rank, 1), 5)}`}>{rank <= 3 ? <Trophy size={23} /> : String(rank).padStart(2, '0')}{rank <= 3 && <b>{rank}</b>}</span><img src={avatar.image} style={{ objectPosition: avatar.position }} alt=""  onError={onArtworkError} /><div><strong>{row.nickname ?? '已注销旅者'}</strong><small>食灵 {save.server} 服</small></div><span className="rank-value">{RANKING_BOARDS[tab].compact ? compactNumber(row.score) : row.score}</span></li>;
  }) : <li className="empty-state"><UserRound size={26} /><p>{boards ? '本服暂无上榜旅者' : '榜单数据暂不可用'}</p><span>{boards ? '创造一场胜利，留下第一个名字。' : '当前处于离线模式，稍后自动重试。'}</span></li>}</ol><div className="my-rank"><UserRound size={22} /><span>{save.profile?.name || '尚未创建角色'}</span><strong>{save.profile ? tab === 1 ? `${save.battleWins} 场胜利` : '新的旅程' : '未上榜'}</strong></div><p className="panel-note centered">{boards ? `实时榜单 · 食灵 ${save.server} 服 · 按服独立排名` : '离线模式 · 榜单数据暂不可用'}</p></div>;
}

export function PreviewPanel({ onSelect }: { onSelect: (screen: typeof previewScreens[number] | typeof featureScreens[number]) => void }) {
  return <div className="preview-panel">
    <p className="preview-intro">十个参考画面，一段完整的灵界初遇。选择任一界面开始体验。</p>
    <div className="preview-grid">{previewScreens.map(screen => <button key={screen.id} onClick={() => onSelect(screen)}><span className="preview-index">{screen.id}</span><span><strong>{screen.name}</strong><small>{screen.description}</small></span><ArrowRight size={17} /></button>)}</div>
    <h3 className="preview-subtitle">主城功能界面</h3>
    <div className="preview-grid">{featureScreens.map(screen => <button key={screen.id} onClick={() => onSelect(screen)}><span className="preview-index">{screen.id}</span><span><strong>{screen.name}</strong><small>{screen.description}</small></span><ArrowRight size={17} /></button>)}</div>
    <p className="panel-note centered">所有界面可独立预览 · 弹窗支持 Esc 或点击遮罩关闭</p>
  </div>;
}

export function CollectionPanel({ save }: { save: GameSave }) {
  const [selected, setSelected] = useState(0);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const character = characters[selected];
  return <div className="collection-panel"><div className="collection-detail"><img src={character.image} style={{ objectPosition: character.position }} alt={character.name}  onError={onArtworkError} /><div><p className="eyebrow">{character.rarity} / {character.element}</p><h3>{character.name}</h3><p className="collection-subtitle">{character.title}</p><Ornament /><p>{character.detail}</p><span className={`ownership ${save.characters.includes(character.name) ? 'owned' : ''}`}>{save.characters.includes(character.name) ? <><Check size={13} /> 已缔结契约</> : <><Star size={13} /> 等待与你相遇</>}</span></div></div><div className="collection-toolbar"><span>食灵图鉴 <small>{save.characters.length} / {characters.length}</small></span><label><input type="checkbox" checked={ownedOnly} onChange={event => setOwnedOnly(event.target.checked)} />仅看已拥有</label></div><div className="character-strip">{characters.map((item, i) => (!ownedOnly || save.characters.includes(item.name)) && <button key={item.name} className={selected === i ? 'selected' : ''} aria-pressed={selected === i} onClick={() => setSelected(i)}><img src={item.image} style={{ objectPosition: item.position }} alt=""  onError={onArtworkError} /><span>{item.name}</span>{save.characters.includes(item.name) && <Check size={13} />}</button>)}</div></div>;
}

export function SummonPanel({ save, onSummon, onCreate }: { save: GameSave; onSummon: (count: number) => typeof characters | null; onCreate: () => void }) {
  const [result, setResult] = useState<typeof characters>([]);
  const summon = (count: number) => { const next = onSummon(count); if (next) setResult(next); };
  return <div className="summon-panel"><p className="summon-intro">以一纸契约，赴一场命定的相遇。</p>{result.length ? <div className={`summon-results ${result.length === 1 ? 'single-result' : ''}`} role="status" aria-label="召唤结果">{result.map((character, i) => <div className="summon-character" key={`${i}-${character.name}`} style={{ animationDelay: `${i * 60}ms` }}><img src={character.image} style={{ objectPosition: character.position }} alt=""  onError={onArtworkError} /><span className="summon-rarity">{character.rarity}</span><strong>{character.name}</strong></div>)}</div> : <div className="summon-circle"><div className="summon-orbit" /><Sigil /><span>命 运 之 门</span></div>}<p className="contract-balance"><ItemArt kind="book" />食灵契约 <strong>{save.books}</strong></p>{save.profile ? <div className="summon-actions"><GoldButton disabled={save.books < 1} onClick={() => summon(1)}>召唤一次<small>消耗 1 份契约</small></GoldButton><GoldButton disabled={save.books < 10} onClick={() => summon(10)}>十次召唤<small>消耗 10 份契约</small></GoldButton></div> : <GoldButton onClick={onCreate}>先创建你的角色</GoldButton>}<p className="panel-note centered">本地模拟召唤，重复食灵不重复计入图鉴；不涉及真实付费抽取。</p></div>;
}

export type AccountIdentityView = { accountId: string; nickname: string } | null;

/** 账号密码区：有身份 → 设置密码（正式注册）；无身份 → 账号 ID + 密码登录找回。 */
/** 密码强度（与后端 isStrongPassword 同口径）：8-64 位且同时包含字母与数字。 */
function isStrongPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 64 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

function CredentialsSection({ identity, onRegisterPassword, onLogin }: {
  identity: AccountIdentityView;
  onRegisterPassword?: (password: string) => Promise<void>;
  onLogin?: (accountId: string, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: () => Promise<void>, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: okText });
    } catch (error) {
      const message = (error as { message?: unknown })?.message;
      setMessage({ kind: 'error', text: typeof message === 'string' && message ? message : '操作失败，请稍后再试' });
    } finally {
      setBusy(false);
    }
  };

  if (!identity) {
    const loginReady = loginId.trim().length > 0 && isStrongPassword(loginPassword);
    return <section className="account-credentials" aria-label="账号登录">
      <h4>找回你的进度</h4>
      <p className="credentials-hint">输入原账号 ID 与密码，登录后云端存档自动回到本机。</p>
      <div className="credentials-form">
        <input value={loginId} onChange={event => setLoginId(event.target.value)} placeholder="账号 ID" aria-label="账号 ID" autoComplete="username" />
        <input value={loginPassword} onChange={event => setLoginPassword(event.target.value)} placeholder="密码" type="password" aria-label="密码" autoComplete="current-password" />
        <button disabled={busy || !loginReady} onClick={() => submit(async () => { await onLogin?.(loginId, loginPassword); }, '登录成功，进度已找回。')}>登录</button>
      </div>
      {message && <p className={`credentials-message ${message.kind}`} role="status">{message.text}</p>}
    </section>;
  }

  const registerReady = isStrongPassword(password);
  return <section className="account-credentials" aria-label="账号密码">
    <h4>正式账号</h4>
    <p className="credentials-hint">账号 ID <code>{identity.accountId}</code> 是唯一的找回凭证，请妥善保存。</p>
    <div className="credentials-form">
      <input value={password} onChange={event => setPassword(event.target.value)} placeholder="设置密码（8-64 位，含字母和数字）" type="password" aria-label="设置密码" autoComplete="new-password" />
      <button disabled={busy || !registerReady} onClick={() => submit(async () => { await onRegisterPassword?.(password); setPassword(''); }, '密码已设置，从此可跨设备登录找回。')}>设置密码</button>
    </div>
    {password && !registerReady && <p className="credentials-message error" role="alert">密码需 8-64 位，且同时包含字母与数字。</p>}
    {message && <p className={`credentials-message ${message.kind}`} role="status">{message.text}</p>}
  </section>;
}

export function AccountPanel({ save, identity, onEdit, onLogout, onReset, onRegisterPassword, onLogin }: {
  save: GameSave;
  identity: AccountIdentityView;
  onEdit: () => void;
  onLogout: () => void;
  onReset: () => void;
  onRegisterPassword?: (password: string) => Promise<void>;
  onLogin?: (accountId: string, password: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  return <div className="account-panel"><div className="account-profile"><img src={artwork.lobby} alt="旅者头像"  onError={onArtworkError} /><div><h3>{save.profile?.name || '尚未命名的旅者'}</h3><p>食灵 {save.server} 服 · {identity ? `云端账户 ${identity.nickname}` : '本地演示账户'}</p></div></div><CredentialsSection identity={identity} onRegisterPassword={onRegisterPassword} onLogin={onLogin} /><button className="account-option" onClick={onEdit}><UserRound size={18} />{save.profile ? '修改旅者信息' : '创建你的角色'}<ChevronRight size={17} /></button><button className="account-option" onClick={onLogout}><ArrowRight size={18} />返回启动页<ChevronRight size={17} /></button>{confirm ? <div className="reset-confirm"><p>确定清除角色、资源和领取记录？此操作不可撤销。</p><button onClick={() => setConfirm(false)}>保留进度</button><button className="danger-button" onClick={onReset}>确认清除</button></div> : <button className="text-button reset-link" onClick={() => setConfirm(true)}>清除本地演示进度</button>}</div>;
}

export function PolicyPanel({ type }: { type: 'terms' | 'privacy' }) {
  return <article className="notice-content policy-content">{type === 'terms' ? <><h3>关于本演示</h3><p>《食灵月城》界面演示用于展示启动、角色创建、主城与活动界面的设计及交互，不是正式运营的游戏服务。</p><h3>演示资源与充值</h3><p>页面中的服务器、榜单、货币、道具及奖励均为演示数据。所有“充值”操作都有明确的演示确认，不调用支付接口，不会产生扣款，也不提供可兑换的现实权益。</p><h3>健康游戏提示</h3><p>抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。</p><h3>年龄提示</h3><p>页面参照 16+ 幻想题材界面设计。请合理安排体验时间，未成年人应在监护人指导下使用。</p></> : <><h3>我们保存哪些信息</h3><p>你输入的角色名字、设置、游戏进度，以及主动保存的聊天内容、草稿、好友和协会演示记录，使用浏览器 localStorage 保存在你的设备上。</p><h3>信息如何使用</h3><p>上述信息仅用于恢复你的界面偏好和本地进度。本应用不把这些信息提交到游戏服务器，不使用广告追踪，也不收集支付信息。</p><h3>如何清除信息</h3><p>打开“旅者账户”并选择“清除本地演示进度”，即可重置角色、奖励和本地社交记录。聊天页可单独清空当前会话中你保存的发言。你也可以通过浏览器设置清除此站点的数据。</p><h3>静态资源</h3><p>插画和字体随本站提供。背景氛围音由浏览器在本地合成，只在你主动开启后播放。</p></>}<Ornament /><p className="panel-note centered">本说明仅适用于当前 UI 演示项目。</p></article>;
}