import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, CircleHelp, Coins, HeartHandshake, LogOut, MessageSquare, Search, Send, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { artwork, compactNumber, type GameSave } from '../game-data';
import {
  canUseThread, GUILD_CHECKIN_COINS, GUILD_DONATION_COST, guildEventLabels, MAX_MESSAGE_LENGTH, normalizeMessage,
  sampleMessages, socialContacts, socialDay, socialGuilds, type ChatChannel, type ChatLocation, type SocialContact,
} from '../social';
import { GoldButton, Sigil, onArtworkError } from './GameUi';
import '../social.css';

export type SocialActions = {
  onRequest: (id: string) => void;
  onAccept: (id: string, source: 'incoming' | 'outgoing') => void;
  onDismiss: (id: string, source: 'incoming' | 'outgoing') => void;
  onRemove: (id: string) => void;
  onApplyGuild: (id: string) => void;
  onCancelGuild: () => void;
  onApproveGuild: () => void;
  onLeaveGuild: () => void;
  onCheckIn: () => void;
  onDonate: () => void;
  onDraft: (thread: string, text: string) => void;
  onSend: (thread: string, text: string) => boolean;
  onClear: (thread: string) => void;
};

function ContactAvatar({ contact, small = false }: { contact: SocialContact; small?: boolean }) {
  return <span className={`social-avatar ${small ? 'small' : ''}`}><img src={contact.image} style={{ objectPosition: contact.position }} alt="" decoding="async"  onError={onArtworkError} /><i className={contact.online ? 'online' : ''} /></span>;
}

function LocalNotice({ children }: { children: React.ReactNode }) {
  return <p className="social-local-notice"><ShieldCheck size={13} /><span>{children}</span></p>;
}

export function FriendPanel({ save, actions, onChat, onCreate }: { save: GameSave; actions: SocialActions; onChat: (id: string) => void; onCreate: () => void }) {
  const [tab, setTab] = useState<'friends' | 'discover' | 'requests'>('friends');
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const social = save.social;
  const query = search.trim().toLocaleLowerCase();
  const match = (contact: SocialContact) => !query || `${contact.name} ${contact.code}`.toLocaleLowerCase().includes(query);
  const friends = socialContacts.filter(contact => social.friends.includes(contact.id));
  const suggested = socialContacts.filter(contact => !social.friends.includes(contact.id));
  const visible = (tab === 'friends' ? friends : suggested).filter(match);
  const incoming = socialContacts.filter(contact => social.incomingRequests.includes(contact.id) && match(contact));
  const outgoing = socialContacts.filter(contact => social.sentRequests.includes(contact.id) && match(contact));
  const requestCount = social.incomingRequests.length + social.sentRequests.length;
  const allMet = tab === 'discover' && suggested.length === 0;

  return <div className="social-friends-panel">
    <div className="social-opening"><div><p className="eyebrow">SOME JOURNEYS ARE BETTER TOGETHER</p><h3>同行的人，也是旅途的风景。</h3></div><span><Users size={15} /><b>{friends.length}</b> / 50</span></div>
    <LocalNotice>旅人、在线状态和邀请均为演示样例。任何操作都不会联系真实玩家。</LocalNotice>
    <div className="social-search"><Search size={16} /><input aria-label="搜索旅人" value={search} onChange={event => setSearch(event.target.value)} placeholder="输入旅人名字或编号" />{search && <button onClick={() => setSearch('')} aria-label="清除搜索"><X size={14} /></button>}</div>
    <div className="simple-tabs social-friend-tabs" role="tablist" aria-label="好友分类">{([['friends', '我的好友', friends.length], ['discover', '结识旅人', suggested.length], ['requests', '申请', requestCount]] as const).map(([key, label, count]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setRemoving(null); }}>{label}<small>{count}</small></button>)}</div>
    {tab !== 'requests' && (visible.length ? <ul className="social-contact-list">{visible.map(contact => {
      const isFriend = social.friends.includes(contact.id);
      const pending = social.sentRequests.includes(contact.id);
      const invited = social.incomingRequests.includes(contact.id);
      return <li key={contact.id} data-contact={contact.id}><div className="social-contact-row"><ContactAvatar contact={contact} /><div className="social-contact-copy"><strong>{contact.name}<small>{contact.online ? '演示在线' : '演示离线'}</small></strong><span>Lv.{contact.level} / 食灵 {contact.server} 服 / No.{contact.code}</span><p>{contact.note}</p></div><div className="social-contact-actions">{isFriend ? <><button className="social-gold-outline" onClick={() => onChat(contact.id)}><MessageSquare size={13} /> 私聊</button><button className="social-remove-link" aria-label={`移除${contact.name}`} disabled={!save.profile} onClick={() => setRemoving(removing === contact.id ? null : contact.id)}>移除</button></> : pending ? <button className="social-pending-link" onClick={() => setTab('requests')}><Check size={13} /> 查看申请</button> : invited ? <button className="social-gold-outline" onClick={() => setTab('requests')}>处理邀请</button> : <button className="social-gold-outline" onClick={() => save.profile ? actions.onRequest(contact.id) : onCreate()}><UserPlus size={13} /> 申请结识</button>}</div></div>{removing === contact.id && <div className="social-inline-confirm"><p>移除后将无法私聊，本地记录会保留。确定移除 {contact.name} 吗？</p><div><button onClick={() => setRemoving(null)}>保留好友</button><button onClick={() => { actions.onRemove(contact.id); setRemoving(null); }}>确认移除</button></div></div>}</li>;
    })}</ul> : <div className="social-empty"><Users size={30} /><h3>{query ? '没有找到这位旅人' : allMet ? '已结识这里的每一位旅人' : '还没有同行的伙伴'}</h3><p>{query ? '试试其他名字或旅人编号。' : allMet ? '回到好友列表，为同行的伙伴写一句问候。' : '从结识旅人开始，在灵界留下一份新的相遇。'}</p><button onClick={() => { setSearch(''); setTab(allMet ? 'friends' : 'discover'); }}>{allMet ? '回到好友列表' : '去结识旅人'} <ArrowRight size={13} /></button></div>)}
    {tab === 'requests' && <div className="social-requests"><section><h3>收到的演示邀请 <span>{incoming.length}</span></h3>{incoming.length ? incoming.map(contact => <div key={contact.id} className="social-request-row" data-request={contact.id}><ContactAvatar contact={contact} small /><div><strong>{contact.name}</strong><span>预置的本地演示邀请</span></div><button className="social-gold-outline" disabled={!save.profile} onClick={() => actions.onAccept(contact.id, 'incoming')}>接受申请</button><button className="social-muted-button" disabled={!save.profile} onClick={() => actions.onDismiss(contact.id, 'incoming')}>婉拒</button></div>) : <p className="social-section-empty">暂无待处理邀请。</p>}</section><section><h3>我的申请 <span>{outgoing.length}</span></h3>{outgoing.length ? outgoing.map(contact => <div key={contact.id} className="social-sent-request" data-request={contact.id}><div className="social-request-row"><ContactAvatar contact={contact} small /><div><strong>{contact.name}</strong><span>申请保存在本地，尚未通过</span></div><button className="social-muted-button" onClick={() => actions.onDismiss(contact.id, 'outgoing')}>撤回申请</button></div><div className="social-approval-note"><span><CircleHelp size={11} /> 不会真实发送，请手动模拟后续流程。</span><button className="social-gold-outline" onClick={() => actions.onAccept(contact.id, 'outgoing')}>模拟对方同意 <Check size={12} /></button></div></div>) : <p className="social-section-empty">还没有发出的本地申请。</p>}</section></div>}
    {!save.profile && <GoldButton className="social-create-button" onClick={onCreate}>创建角色后管理好友</GoldButton>}
    <p className="social-footnote">好友与申请在当前浏览器保存。私聊只记录你写下的话，不会模拟真人回复。</p>
  </div>;
}

export function ChatPanel({ save, actions, location, onFriends, onGuild, onCreate }: { save: GameSave; actions: SocialActions; location: ChatLocation; onFriends: () => void; onGuild: () => void; onCreate: () => void }) {
  const [channel, setChannel] = useState<ChatChannel>(location.channel);
  const [contactId, setContactId] = useState(location.contactId || save.social.friends[0] || '');
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const friends = socialContacts.filter(contact => save.social.friends.includes(contact.id));
  const contact = friends.find(item => item.id === contactId) || friends[0];
  const guild = socialGuilds.find(item => item.id === save.social.guildId);
  const thread = channel === 'world' ? 'world' : channel === 'guild' ? `guild:${guild?.id || 'none'}` : `dm:${contact?.id || 'none'}`;
  const allowed = canUseThread(save, thread);
  const messages = save.social.messages.filter(message => message.thread === thread);
  const examples = sampleMessages(thread);
  const draft = save.social.drafts[thread] || '';
  const title = channel === 'world' ? '世界茶话' : channel === 'guild' ? guild?.name || '协会频道' : contact?.name || '选择一位旅人';
  const updateChannel = (next: ChatChannel) => { setChannel(next); setClearing(false); setError(''); };
  const chooseContact = (id: string) => { setContactId(id); updateChannel('whisper'); };

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [thread, messages.length]);

  return <div className="social-chat-panel">
    <LocalNotice>这是单机演示会话。你写下的话仅保存于当前设备，不会发送给真实玩家。</LocalNotice>
    <div className="simple-tabs social-chat-tabs" role="tablist" aria-label="聊天频道">{([['world', '世界'], ['guild', '协会'], ['whisper', '私聊']] as const).map(([id, name]) => <button key={id} role="tab" aria-selected={channel === id} onClick={() => updateChannel(id)}>{name}</button>)}</div>
    <div className="social-chat-layout"><aside className="social-chat-contacts"><header><span>同行者</span><small>{friends.length}</small></header>{friends.map(item => <button key={item.id} onClick={() => chooseContact(item.id)} aria-pressed={channel === 'whisper' && contact?.id === item.id}><ContactAvatar contact={item} small /><span><strong>{item.name}</strong><small>本地私聊记录</small></span></button>)}<button className="social-chat-add" onClick={onFriends}><UserPlus size={13} /> 结识更多旅人</button></aside>
      <div className="social-thread"><header className="social-thread-heading"><div><span>{channel === 'world' ? 'WORLD CHANNEL' : channel === 'guild' ? 'GUILD CHANNEL' : 'PRIVATE JOURNAL'}</span><h3>{title}</h3></div><button aria-label="清空本频道记录" disabled={!allowed || !messages.length} onClick={() => setClearing(!clearing)}><Trash2 size={14} /></button></header>
        {channel === 'whisper' && friends.length > 0 && <label className="social-recipient-select"><span>私聊对象</span><select aria-label="私聊对象" value={contact?.id || ''} onChange={event => chooseContact(event.target.value)}>{friends.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        {clearing && <div className="social-clear-confirm"><p>只清空本会话中你写下的记录，其他频道与示例发言不变。</p><div><button onClick={() => setClearing(false)}>保留记录</button><button onClick={() => { actions.onClear(thread); setClearing(false); }}>确认清空</button></div></div>}
        {channel === 'guild' && !guild ? <div className="social-chat-gate"><Users size={29} /><h3>先找到属于你的协会</h3><p>加入本地协会后，即可体验独立的协会频道。</p><button className="social-gold-outline" onClick={onGuild}>前往协会 <ArrowRight size={13} /></button></div> : channel === 'whisper' && !contact ? <div className="social-chat-gate"><HeartHandshake size={29} /><h3>旅途，等一次新的相遇</h3><p>先在好友页面结识旅人，再建立本地私聊记录。</p><button className="social-gold-outline" onClick={onFriends}>前往好友 <ArrowRight size={13} /></button></div> : <div className="social-chat-log" role="log" aria-label={`${title}的聊天记录`} aria-live="polite" ref={logRef}>
          {examples.map((message, index) => {
            const speaker = socialContacts.find(item => item.id === message.contactId)!;
            return <article className="social-message sample" key={`example-${thread}-${index}`}><ContactAvatar contact={speaker} small /><div><header><strong>{speaker.name}</strong><span>示例发言</span></header><p>{message.text}</p></div></article>;
          })}
          {!messages.length && !examples.length && <div className="social-conversation-empty"><MessageSquare size={23} /><p>还没有写下的故事。</p><span>从一句问候开始，留作旅途中的一页日记。</span></div>}
          {messages.map(message => <article className="social-message self" key={message.id} data-message={message.id}><div><header><strong>{save.profile?.name || '我'}</strong><span>{new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · 仅本地</span></header><p>{message.text}</p></div><span className="social-self-avatar"><img src={artwork.lobby} style={{ objectPosition: '51% 25%' }} alt=""  onError={onArtworkError} /></span></article>)}
        </div>}
        <form className="social-chat-composer" ref={formRef} onSubmit={event => {
          event.preventDefault();
          if (!normalizeMessage(draft)) { setError(`请输入 1 至 ${MAX_MESSAGE_LENGTH} 个有效字符。`); return; }
          if (actions.onSend(thread, draft)) setError(''); else setError('当前会话不可发送，请检查好友或协会状态。');
        }}><label className="sr-only" htmlFor="local-chat-message">聊天内容</label><textarea id="local-chat-message" value={draft} disabled={!allowed} maxLength={MAX_MESSAGE_LENGTH * 2} placeholder={allowed ? '写一句问候，保存在你的旅途中…' : '先创建角色并解锁当前会话'} onChange={event => { actions.onDraft(thread, event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); formRef.current?.requestSubmit(); } }} /><div><span>{error ? <b role="alert">{error}</b> : `${Array.from(draft).length} / ${MAX_MESSAGE_LENGTH} · 草稿按会话保存`}</span><button type="submit" disabled={!allowed || !normalizeMessage(draft)}><Send size={13} /> 保存发言</button></div></form>
      </div>
    </div>
    {!save.profile && <button className="social-create-link" onClick={onCreate}>创建角色后体验本地聊天 <ArrowRight size={13} /></button>}
    <p className="social-footnote">每个会话最多保存 80 条，总计最多 200 条。切换频道不会混入其他对象的记录。</p>
  </div>;
}

export function GuildPanel({ save, actions, onChat, onFriends, onCreate }: { save: GameSave; actions: SocialActions; onChat: () => void; onFriends: () => void; onCreate: () => void }) {
  const [tab, setTab] = useState('hall');
  const [leaving, setLeaving] = useState(false);
  const social = save.social;
  const guild = socialGuilds.find(item => item.id === social.guildId);
  const applied = socialGuilds.find(item => item.id === social.guildApplication);
  const checkedIn = social.guildCheckInDate === socialDay();
  const donated = social.guildDonationDate === socialDay();

  if (!guild) return <div className="social-guild-discovery"><div className="social-guild-invitation"><Sigil /><p className="eyebrow">A PLACE TO RETURN TOGETHER</p><h3>为旅途，找到一盏归来的灯。</h3><p>选择一家本地演示协会，记录你的申请与加入故事。</p></div><LocalNotice>协会与成员均为样例。申请不会发往服务器，需手动点击“模拟审批通过”。</LocalNotice>
    {applied && <section className="social-guild-application"><span className="social-guild-small-seal"><BookOpen size={20} /></span><div><strong>已记录对「{applied.name}」的申请</strong><p>审批尚未完成，刷新后仍可继续。</p><div><button className="social-gold-outline" onClick={actions.onApproveGuild}>模拟审批通过 <Check size={12} /></button><button className="social-muted-button" onClick={actions.onCancelGuild}>撤回申请</button></div></div></section>}
    <ul className="social-guild-list">{socialGuilds.map(item => <li key={item.id}><img src={item.image} alt="" decoding="async"  onError={onArtworkError} /><div><p>{item.english}</p><h3>{item.name}</h3><span>Lv.{item.level} / {item.members} / {item.capacity} 位演示成员</span><small>{item.motto}</small></div><button className="social-gold-outline" disabled={!!applied} onClick={() => save.profile ? actions.onApplyGuild(item.id) : onCreate()}>{applied?.id === item.id ? '已申请' : save.profile ? '申请加入' : '创建角色后申请'}</button></li>)}</ul><p className="social-footnote">同一时间只能保留一份协会申请，可随时撤回并重新选择。</p></div>;

  const members = guild.contacts.map(id => socialContacts.find(contact => contact.id === id)!);
  const events = social.guildEvents.filter(event => event.guildId === guild.id);
  return <div className="social-guild-home"><header className="social-guild-banner"><img src={guild.image} alt={`${guild.name}的幻想庭院`} decoding="async"  onError={onArtworkError} /><div /><span className="social-guild-banner-seal"><Sigil /></span><section><p className="eyebrow">{guild.english}</p><h3>{guild.name}</h3><span>Lv.{guild.level} / {guild.members + 1} / {guild.capacity} 位演示成员</span></section></header>
    <div className="simple-tabs social-guild-tabs" role="tablist" aria-label="协会页面">{[['hall', '协会大厅'], ['members', '成员一览'], ['events', '本地日志']].map(([id, name]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{name}</button>)}</div>
    {tab === 'hall' && <div className="social-guild-hall"><div className="social-guild-motto"><p>{guild.motto}</p><span>{guild.notice}</span></div><div className="social-guild-contribution"><HeartHandshake size={16} /><span>你的旅者贡献</span><strong>{social.contribution.toLocaleString()}</strong><small>仅本地记录</small></div><div className="social-guild-dailies"><div><span className="social-daily-icon"><Check size={19} /></span><div><h4>每日一份问候</h4><p>签到获得 {GUILD_CHECKIN_COINS.toLocaleString()} 金币与 20 贡献</p></div><button aria-label="协会签到" className="social-gold-outline" disabled={checkedIn} onClick={actions.onCheckIn}>{checkedIn ? '今日已签到' : '今日签到'}</button></div><div><span className="social-daily-icon"><Coins size={19} /></span><div><h4>为同伴添一盏灯</h4><p>捐献 {GUILD_DONATION_COST.toLocaleString()} 金币，贡献 +30</p></div><button aria-label="协会捐献" className="social-gold-outline" disabled={donated || save.coins < GUILD_DONATION_COST} onClick={actions.onDonate}>{donated ? '今日已捐献' : save.coins < GUILD_DONATION_COST ? '金币不足' : '捐献金币'}</button></div></div><p className="social-daily-note">当前金币 {compactNumber(save.coins)}。每日次数按旅者记录，退出再加入不会重置。</p><GoldButton className="social-guild-chat-button" onClick={onChat}><MessageSquare size={15} /> 前往协会频道 <ArrowRight size={15} /></GoldButton></div>}
    {tab === 'members' && <div className="social-guild-members"><p className="social-member-note">以下为预置演示成员；人数和在线状态不连接服务器。</p><div className="social-guild-self"><span className="social-self-avatar"><img src={artwork.lobby} alt="" style={{ objectPosition: '51% 25%' }}  onError={onArtworkError} /></span><div><strong>{save.profile?.name} <small>你</small></strong><span>旅者 / 贡献 {social.contribution}</span></div><Check size={14} /></div>{members.map(contact => <div key={contact.id} className="social-guild-member"><ContactAvatar contact={contact} small /><div><strong>{contact.name}</strong><span>演示成员 / Lv.{contact.level}</span></div>{social.friends.includes(contact.id) ? <span className="social-already-friend">已是好友</span> : <button className="social-gold-outline" onClick={onFriends}>前往结识</button>}</div>)}</div>}
    {tab === 'events' && <div className="social-guild-event-log"><p>这里只记录你在当前浏览器执行的操作。</p>{events.map(event => <article key={event.id}><i /><div><strong>{guildEventLabels[event.type]}</strong><span>{new Date(event.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div></article>)}</div>}
    <footer className="social-guild-footer"><LocalNotice>本地协会演示，不会联系真实成员。</LocalNotice>{leaving ? <div className="social-inline-confirm"><p>确定退出「{guild.name}」吗？个人贡献、会话和每日领取记录会保留。</p><div><button onClick={() => setLeaving(false)}>继续同行</button><button onClick={() => { actions.onLeaveGuild(); setLeaving(false); }}>确认退出协会</button></div></div> : <button className="social-leave-link" onClick={() => setLeaving(true)}><LogOut size={12} /> 退出本地协会</button>}</footer>
  </div>;
}