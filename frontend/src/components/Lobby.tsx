import { useState } from 'react';
import {
  mailList, quests,
  type GameSave, type MailItem, type Quest,
} from '../game-data';
import { GoldButton, ItemArt, Ornament, Rewards } from './GameUi';

const groups = ['全部', '日常', '成长', '主线'] as const;

export function QuestPanel({ save, onClaim }: { save: GameSave; onClaim: (quest: Quest) => void }) {
  const [group, setGroup] = useState<(typeof groups)[number]>('全部');
  const list = quests.filter(quest => group === '全部' || quest.group === group);
  const done = quests.filter(quest => quest.progress(save)[0] >= quest.progress(save)[1]).length;
  return <div className="quest-panel">
    <p className="panel-progress">已完成 <strong>{done}</strong> / {quests.length} 项委托<span>奖励直接放入旅者行囊</span></p>
    <div className="simple-tabs" role="tablist" aria-label="任务类型">{groups.map(item => <button key={item} role="tab" aria-selected={group === item} onClick={() => setGroup(item)}>{item}</button>)}</div>
    <ul className="quest-list">
      {list.map(quest => {
        const [current, target] = quest.progress(save);
        const complete = current >= target;
        const claimed = save.claimedQuests.includes(quest.id);
        const percent = Math.min(100, Math.round(current / target * 100));
        return <li key={quest.id} className={claimed ? 'claimed' : ''}>
          <div className="quest-copy"><span className="quest-group">{quest.group}</span><strong>{quest.name}</strong><small>{quest.detail}</small></div>
          <div className="quest-state">
            <div className="quest-bar"><i style={{ width: `${percent}%` }} /><span>{current}/{target}</span></div>
            <div className="quest-rewards">{quest.rewards.map(reward => <ItemArt key={reward.label} kind={reward.kind} className="quest-art" />)}</div>
            <button className="claim-chip" disabled={!complete || claimed} onClick={() => onClaim(quest)}>{claimed ? '已领取' : complete ? '领取' : '进行中'}</button>
          </div>
        </li>;
      })}
    </ul>
    <p className="panel-note centered">任务进度由当前存档推算，登录云端后随存档自动同步</p>
  </div>;
}

export function MailPanel({ save, onClaim }: { save: GameSave; onClaim: (item: MailItem) => void }) {
  const [openId, setOpenId] = useState(mailList[0].id);
  const item = mailList.find(entry => entry.id === openId) ?? mailList[0];
  const claimed = save.claimedMail.includes(item.id);
  return <div className="mail-panel">
    <div className="mail-columns">
      <ul className="mail-list">{mailList.map(entry => (
        <li key={entry.id}>
          <button className={entry.id === openId ? 'selected' : ''} aria-pressed={entry.id === openId} onClick={() => setOpenId(entry.id)}>
            <span className="mail-dot" data-unread={!save.claimedMail.includes(entry.id)} />
            <span className="mail-summary"><strong>{entry.title}</strong><small>{entry.sender}</small></span>
            <span className="mail-time">{entry.time}</span>
          </button>
        </li>
      ))}</ul>
      <article className="mail-detail">
        <p className="mail-sender">{item.sender}<span>{item.time}</span></p>
        <h3>{item.title}</h3>
        <Ornament />
        <p className="mail-body">{item.excerpt}若附件超出有效期限，系统将自动回收。请在旅者行囊中确认领取结果。</p>
        <p className="mail-attachment">附件 <small>{item.rewards.length} 项</small></p>
        <Rewards items={item.rewards} small />
        <GoldButton disabled={claimed} onClick={() => onClaim(item)}>{claimed ? '附件已领取' : '领取附件'}</GoldButton>
      </article>
    </div>
    <p className="panel-note centered">演示邮件，内容与奖励仅保存在本地</p>
  </div>;
}
