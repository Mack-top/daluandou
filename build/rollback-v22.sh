#!/usr/bin/env bash
# =============================================================================
# 食灵月城 v22 · 云端回滚脚本（在云端服务器上运行）
# =============================================================================
# 用法（在【本地】仓库根目录执行，脚本在云端服务器上运行）：
#   ssh -o BatchMode=yes ubuntu@193.112.28.143 'bash -s' -- < build/rollback-v22.sh [备份目录]
#   # 不带参数时自动选用最新的 /home/ubuntu/meishi/backup-v22-* 部署备份目录；
#   # 也可显式指定：'bash -s' -- < build/rollback-v22.sh /home/ubuntu/meishi/backup-v22-20261105-101500
#
# 回滚内容（两级）：
#   1) 部署级回滚（backup-v22-<ts>/，由 deploy-v22.sh 创建）：
#      server.cjs / schema.sql / index.html / admin.html 恢复为部署前版本；
#      admin.html 同时恢复到 backend/public/ 与 webapp/ 两处。
#   2) 资源级回滚（backup-final/pre-v22-*.tar.gz，由 backup-and-clean-cloud.sh 创建）：
#      把 webapp/images、webapp/fonts、webapp/favicon.svg 与两个历史 backup 目录
#      从 tar 原样解回（--skip-old-files，不覆盖已有文件）。
#   3) 重启 meishi 并做 /api/health 健康检查（带超时）。
#
# 永不触碰：/home/ubuntu/meishi/data/（存档 game.db 只读不动）。
# =============================================================================
set -euo pipefail

BASE=/home/ubuntu/meishi
HEALTH_URL="http://127.0.0.1:8787/api/health"
HEALTH_TRIES=30
HEALTH_INTERVAL=2

log()  { printf '[rollback] %s\n' "$*"; }
warn() { printf '[rollback][WARN] %s\n' "$*"; }
die()  { printf '[rollback][ABORT] %s\n' "$*" >&2; exit 1; }

# ---------- 0. 选用部署备份目录 ----------
BACKUP_DIR="${1:-}"
if [ -z "$BACKUP_DIR" ]; then
  BACKUP_DIR=$(ls -1dt "$BASE"/backup-v22-* 2>/dev/null | head -n 1 || true)
fi
[ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ] || die "未找到部署备份目录（backup-v22-*），无法回滚部署文件。"
log "使用部署备份目录：$BACKUP_DIR"
ls -la "$BACKUP_DIR"

# ---------- 1. 恢复部署文件（存在才恢复，逐个 cp） ----------
restore() { # $1=备份内文件名  $2=恢复目标
  local src="$BACKUP_DIR/$1" dst="$2"
  if [ -s "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
    log "已恢复 $1 -> $dst"
  else
    warn "备份中不存在 $1，跳过（$dst 保持现状）"
  fi
}
restore server.cjs "$BASE/backend/dist/server.cjs"
restore schema.sql "$BASE/backend/dist/schema.sql"
restore index.html "$BASE/webapp/index.html"
restore admin.html "$BASE/backend/public/admin.html"
restore admin.html "$BASE/webapp/admin.html"

# ---------- 2. 解回被清理的静态资源（pre-v22 tar，可多选一最新） ----------
TARBALL="${2:-}"
if [ -z "$TARBALL" ]; then
  TARBALL=$(ls -1t "$BASE"/backup-final/pre-v22-*.tar.gz 2>/dev/null | head -n 1 || true)
fi
if [ -n "$TARBALL" ] && [ -s "$TARBALL" ]; then
  tar tzf "$TARBALL" >/dev/null || die "备份 tar 校验失败：$TARBALL"
  tar xzf "$TARBALL" -C "$BASE" --skip-old-files
  log "已从 $TARBALL 解回被清理的静态资源/历史备份（--skip-old-files 不覆盖现有文件）。"
else
  warn "未找到 backup-final/pre-v22-*.tar.gz，跳过静态资源恢复（若清理未执行过则属正常）。"
fi

# ---------- 3. 重启并健康检查 ----------
log "重启 meishi 服务..."
systemctl restart meishi
log "轮询 $HEALTH_URL（最多 ${HEALTH_TRIES} 次 x ${HEALTH_INTERVAL}s）..."
HEALTH_OK=0
for i in $(seq 1 "$HEALTH_TRIES"); do
  if RESP=$(curl -s --max-time 3 "$HEALTH_URL" 2>/dev/null) && printf '%s' "$RESP" | grep -q '"ok":true'; then
    HEALTH_OK=1
    log "第 $i 次轮询健康检查通过。"
    break
  fi
  sleep "$HEALTH_INTERVAL"
done
[ "$HEALTH_OK" = "1" ] || die "回滚后健康检查未通过，需人工介入（journalctl -u meishi -n 50）。"

# ---------- 4. 终态输出 ----------
log "回滚完成。服务状态：$(systemctl is-active meishi)"
printf '%s\n' "$RESP"
du -sh "$BASE"
find "$BASE/webapp" -type f | sort
