/**
 * 页面间通信事件总线（Event Bus）
 * 用于 uni-app 页面之间解耦通信，支持：
 * 1. 同页面内组件间通信
 * 2. 不同页面间广播通信（通过 uni.$emit / uni.$on）
 * 3. 页面跳转时携带参数并接收回传（通过 getOpenerEventChannel）
 *
 * 使用示例：
 *   // 发送方页面
 *   import { eventBus } from '@/utils/event-bus.js';
 *   eventBus.emit('character-selected', { id: 'qing', name: '青团' });
 *
 *   // 接收方页面（onLoad 中订阅，onUnmounted 中取消）
 *   eventBus.on('character-selected', (data) => { ... });
 *   eventBus.off('character-selected');
 */

const callbacks = {};

/** 订阅事件 */
export function on(eventName, callback) {
  if (!callbacks[eventName]) {
    callbacks[eventName] = [];
  }
  callbacks[eventName].push(callback);
  return () => off(eventName, callback); // 返回取消订阅函数
}

/** 取消订阅 */
export function off(eventName, callback) {
  if (!callbacks[eventName]) return;
  if (callback) {
    callbacks[eventName] = callbacks[eventName].filter((cb) => cb !== callback);
  } else {
    delete callbacks[eventName];
  }
}

/** 发布事件 */
export function emit(eventName, data) {
  if (!callbacks[eventName]) return;
  callbacks[eventName].forEach((cb) => cb(data));
}

/** 一次性订阅 */
export function once(eventName, callback) {
  const unsubscribe = on(eventName, (data) => {
    unsubscribe();
    callback(data);
  });
  return unsubscribe;
}

export const eventBus = { on, off, emit, once };

export default { on, off, emit, once };
