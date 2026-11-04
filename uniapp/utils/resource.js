/**
 * 静态美术资源路径辅助函数
 * 统一管理 uni-app 项目的静态资源 URL，避免硬编码路径
 *
 * 资源目录：static/
 * 引用方式：import { getCharacterAvatar } from '@/utils/resource.js'
 */

const STATIC_BASE = '/static'

/** 角色头像路径 */
export function getCharacterAvatar(characterId) {
  return `${STATIC_BASE}/images/characters/${characterId}_avatar.png`
}

/** 角色立绘路径 */
export function getCharacterFull(characterId) {
  return `${STATIC_BASE}/images/characters/${characterId}_full.png`
}

/** 角色小图标路径 */
export function getCharacterIcon(characterId) {
  return `${STATIC_BASE}/images/characters/${characterId}_icon.png`
}

/** 道具图标路径 */
export function getItemIcon(itemId) {
  return `${STATIC_BASE}/images/items/${itemId}.png`
}

/** 品质框路径（R/SR/SSR） */
export function getRarityFrame(rarity) {
  return `${STATIC_BASE}/images/items/rarity_${rarity}.png`
}

/** UI 元素路径 */
export function getUiImage(name) {
  return `${STATIC_BASE}/images/ui/${name}.png`
}

/** 背景图路径 */
export function getBackground(scene, purpose = 'default') {
  return `${STATIC_BASE}/images/backgrounds/${scene}_${purpose}.png`
}

/** 战斗资源路径 */
export function getBattleResource(name) {
  return `${STATIC_BASE}/images/battle/${name}.png`
}

/** 图标路径 */
export function getIcon(name) {
  return `${STATIC_BASE}/icons/${name}.png`
}

/** 导航图标路径 */
export function getNavIcon(name) {
  return `${STATIC_BASE}/icons/nav_${name}.png`
}

/** 功能图标路径 */
export function getFuncIcon(name) {
  return `${STATIC_BASE}/icons/func_${name}.png`
}

/** 状态图标路径 */
export function getStatusIcon(state) {
  return `${STATIC_BASE}/icons/status_${state}.png`
}

/** 获取任意静态资源绝对路径 */
export function getStaticUrl(relativePath) {
  // 确保路径以 /static/ 开头
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
  return `${STATIC_BASE}${normalized}`
}

/** 检查资源是否存在（通过 uni.getImageInfo，仅在编译后生效） */
export function checkResourceExists(url) {
  return new Promise((resolve) => {
    uni.getImageInfo({
      src: url,
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

export default {
  getCharacterAvatar,
  getCharacterFull,
  getCharacterIcon,
  getItemIcon,
  getRarityFrame,
  getUiImage,
  getBackground,
  getBattleResource,
  getIcon,
  getNavIcon,
  getFuncIcon,
  getStatusIcon,
  getStaticUrl,
  checkResourceExists,
}
