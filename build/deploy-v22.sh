#!/usr/bin/env bash
# =============================================================================
# 食灵月城 v22 · 云端部署脚本（本地 -> 193.112.28.143）
# =============================================================================
# 用法（在【本地】仓库根目录执行）：
#   bash build/deploy-v22.sh
#   # 可选参数：--dry-run（只校验本地产物与连通性，不上传不重启）
#
# 上传清单（目标为云端平铺布局，schema.sql 目标是 backend/dist/schema.sql，
# 不要写成 backend/dist/db/schema.sql —— 服务器 dist/ 下没有 db/ 子目录）：
#   build/exe/server.cjs        -> /home/ubuntu/meishi/backend/dist/server.cjs
#   backend/dist/db/schema.sql  -> /home/ubuntu/meishi/backend/dist/schema.sql
#   frontend/dist/index.html    -> /home/ubuntu/meishi/webapp/index.html
#   backend/public/admin.html   -> /home/ubuntu/meishi/backend/public/admin.html
#                                  + /home/ubuntu/meishi/webapp/admin.html
#   （双份 admin.html：v22 server.cjs 的 /admin 由 webapp/ 提供（webappReady 时
#    adminDir = webappDir）；backend/public/ 一份沿用旧位置以保持回滚兼容。）
#
# 每个目标文件上传前先在云端 cp 到带时间戳备份目录 /home/ubuntu/meishi/backup-v22-<ts>/
# 上传后 systemctl restart meishi，轮询 /api/health（带超时，不无限等）。
#
# 回滚：bash build/rollback-v22.sh（见该脚本头部说明）
# =============================================================================
set -euo pipefail

HOST=ubuntu@193.112.28.143
BASE=/home/ubuntu/meishi
STAMP=$(date +%Y%m%d-%H%M%S)
REMOTE_BACKUP_DIR="$BASE/backup-v22-$STAMP"
HEALTH_URL="http://127.0.0.1:8787/api/health"
HEALTH_TRIES=30          # 30 次 x 2 秒 = 最多等 60 秒
HEALTH_INTERVAL=2

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

log()  { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy][WARN] %s\n' "$*"; }
die()  { printf '[deploy][ABORT] %s\n' "$*" >&2; exit 1; }

# 本地产物 -> 远端绝对路径（显式成对列出，防手滑）
PAIRS=(
  "build/exe/server.cjs|$BASE/backend/dist/server.cjs"
  "backend/dist/db/schema.sql|$BASE/backend/dist/schema.sql"
  "frontend/dist/index.html|$BASE/webapp/index.html"
  "backend/public/admin.html|$BASE/backend/public/admin.html"
  "backend/public/admin.html|$BASE/webapp/admin.html"
)

# ---------- 1. 本地产物校验 ----------
log "校验本地产物..."
for pair in "${PAIRS[@]}"; do
  local_file="${pair%%|*}"
  [ -s "$local_file" ] || die "本地产物缺失或为空：$local_file"
  log "  OK  $local_file ($(wc -c < "$local_file") bytes)"
done
# 前端单文件自包含校验：index.html 必须包含内联 data URI，体积应远大于 v21 的 627KB
INDEX_BYTES=$(wc -c < frontend/dist/index.html)
[ "$INDEX_BYTES" -gt 2000000 ] || die "frontend/dist/index.html 仅 $INDEX_BYTES 字节，疑似未内联资源（v22 单文件应 >2MB）。请先完成 npm run build。"

# ---------- 2. 云端连通性与服务状态 ----------
log "检查云端连通性..."
# 服务器 sshd 偶发限流（连接过密时 kex 阶段被关闭），重试 3 次，间隔 5 秒
SSH_OK=0
for i in 1 2 3; do
  if ssh -o BatchMode=yes "$HOST" 'echo ssh-ok' >/dev/null 2>&1; then
    SSH_OK=1
    break
  fi
  warn "第 $i 次 SSH 探测失败，5 秒后重试..."
  sleep 5
done
[ "$SSH_OK" = "1" ] || die "SSH 连接失败（重试 3 次）：$HOST"
log "SSH OK"

if [ "$DRY_RUN" = "1" ]; then
  log "dry-run 结束：未上传、未重启。"
  exit 0
fi

# ---------- 3. 云端预备份（cp 保留最近版本以便回滚） ----------
log "云端备份当前文件 -> $REMOTE_BACKUP_DIR"
ssh -o BatchMode=yes "$HOST" "
set -e
mkdir -p '$REMOTE_BACKUP_DIR'
cp -a '$BASE/backend/dist/server.cjs'   '$REMOTE_BACKUP_DIR/server.cjs'
cp -a '$BASE/backend/dist/schema.sql'   '$REMOTE_BACKUP_DIR/schema.sql'
cp -a '$BASE/webapp/index.html'         '$REMOTE_BACKUP_DIR/index.html'
cp -a '$BASE/backend/public/admin.html' '$REMOTE_BACKUP_DIR/admin.html'
ls -la '$REMOTE_BACKUP_DIR'
"

# ---------- 4. 逐个 scp 上传 ----------
for pair in "${PAIRS[@]}"; do
  local_file="${pair%%|*}"
  remote_file="${pair##*|}"
  log "上传 $local_file -> $HOST:$remote_file"
  scp -q -o BatchMode=yes "$local_file" "$HOST:$remote_file"
done
log "上传完成，校验远端文件大小："
ssh -o BatchMode=yes "$HOST" "stat -c '%n %s bytes' '$BASE/backend/dist/server.cjs' '$BASE/backend/dist/schema.sql' '$BASE/webapp/index.html' '$BASE/backend/public/admin.html' '$BASE/webapp/admin.html'"

# ---------- 5. 重启服务并轮询健康检查 ----------
log "重启 meishi 服务..."
ssh -o BatchMode=yes "$HOST" "sudo systemctl restart meishi"

log "轮询 $HEALTH_URL（最多 ${HEALTH_TRIES} 次 x ${HEALTH_INTERVAL}s）..."
HEALTH_OK=0
for i in $(seq 1 "$HEALTH_TRIES"); do
  if RESP=$(ssh -o BatchMode=yes "$HOST" "curl -s --max-time 3 '$HEALTH_URL'" 2>/dev/null) && printf '%s' "$RESP" | grep -q '"ok":true'; then
    HEALTH_OK=1
    log "第 $i 次轮询健康检查通过。"
    break
  fi
  sleep "$HEALTH_INTERVAL"
done

[ "$HEALTH_OK" = "1" ] || die "健康检查在 ${HEALTH_TRIES} 次轮询内未通过，请立即执行回滚：bash build/rollback-v22.sh"

# ---------- 6. 终态输出 ----------
log "服务状态与健康响应："
ssh -o BatchMode=yes "$HOST" "systemctl is-active meishi; curl -s --max-time 5 '$HEALTH_URL'; echo"
log "部署完成。回滚命令：ssh -o BatchMode=yes $HOST 'bash -s' < build/rollback-v22.sh  # 参数 $STAMP"
