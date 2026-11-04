#!/usr/bin/env bash
# =============================================================================
# 食灵月城 v22 · 云端资源备份与清理脚本（幂等、可回滚）
# =============================================================================
# 用法（在【本地】仓库根目录执行，脚本在云端服务器上运行）：
#   ssh -o BatchMode=yes ubuntu@193.112.28.143 'bash -s' < build/backup-and-clean-cloud.sh
#
# 前置条件：
#   1) 已获用户批准的删除范围（本脚本硬编码，不含任何通配）：
#      - /home/ubuntu/meishi/webapp/images/          （22 个文件，已被 index.html 内联）
#      - /home/ubuntu/meishi/webapp/fonts/           （5 个文件，已被 index.html 内联）
#      - /home/ubuntu/meishi/webapp/favicon.svg      （已被 index.html 内联）
#      - /home/ubuntu/meishi/backup-20261104-1220/   （历史备份 3.2M）
#      - /home/ubuntu/meishi/backup-20261104-1347/   （历史备份 2.0M）
#   2) 绝不触碰（白名单保护，见 PROTECTED）：
#      data/（存档 game.db）、backend/dist/（server.cjs + schema.sql）、
#      backend/public/（admin.html）、webapp/index.html
#
# 流程：打包 → 校验（非空 + tar tzf 可列条目）→ db 在线快照（python3 sqlite3
#       backup API，WAL 安全，校验 >500KB 且 quick_check=ok）→ 任一校验失败立即中止 →
#       逐个（存在才）删除 → 打印 du / find 供人工核对。
#
# 回滚（在云端执行，把 tar 原样解回 /home/ubuntu/meishi）：
#   tar xzf /home/ubuntu/meishi/backup-final/pre-v22-<时间戳>.tar.gz -C /home/ubuntu/meishi
#   # 或用配套脚本：ssh -o BatchMode=yes ubuntu@193.112.28.143 'bash -s' < build/rollback-v22.sh
# =============================================================================
set -euo pipefail

BASE=/home/ubuntu/meishi
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BASE/backup-final"
TARBALL="$BACKUP_DIR/pre-v22-$STAMP.tar.gz"

# ---- 白名单保护：以下路径/前缀绝不允许删除（脚本内硬编码，非参数可控） ----
PROTECTED=(
  "$BASE/data"
  "$BASE/backend/dist"
  "$BASE/backend/public"
  "$BASE/webapp/index.html"
)

# ---- 待删清单：显式路径，一个一个删，不用通配 ----
TARGETS=(
  "$BASE/webapp/images"
  "$BASE/webapp/fonts"
  "$BASE/webapp/favicon.svg"
  "$BASE/backup-20261104-1220"
  "$BASE/backup-20261104-1347"
)

log()  { printf '[clean] %s\n' "$*"; }
warn() { printf '[clean][WARN] %s\n' "$*"; }
die()  { printf '[clean][ABORT] %s\n' "$*" >&2; exit 1; }

# 删除守卫：目标命中白名单（自身或位于其前缀之下）即拒绝
guard() {
  local target="$1"
  for p in "${PROTECTED[@]}"; do
    if [ "$target" = "$p" ] || [[ "$target/" == "$p/"* ]]; then
      die "拒绝删除受保护路径：$target"
    fi
  done
}

log "开始：v22 云端资源备份与清理（时间戳 $STAMP）"

# ---------- 1. 过滤出实际存在的待删路径 ----------
EXISTING=()
for t in "${TARGETS[@]}"; do
  if [ -e "$t" ]; then
    EXISTING+=("$t")
  else
    warn "不存在（幂等跳过）：$t"
  fi
done

if [ "${#EXISTING[@]}" -eq 0 ]; then
  log "全部待删路径均不存在，无需清理（幂等退出）。"
  exit 0
fi

# ---------- 2. 打包备份到 backup-final ----------
mkdir -p "$BACKUP_DIR"
log "打包备份 ${#EXISTING[@]} 个路径 -> $TARBALL"
tar czf "$TARBALL" -C "$BASE" \
  $(printf '%s\n' "${EXISTING[@]}" | sed "s|^$BASE/||")

# ---------- 3. 备份校验：非空 + 可列条目，失败立即中止（不删任何东西） ----------
[ -s "$TARBALL" ] || die "备份文件为空或未生成：$TARBALL"
LIST_OUT=$(tar tzf "$TARBALL") || die "tar tzf 校验失败：$TARBALL"
ENTRY_COUNT=$(printf '%s\n' "$LIST_OUT" | grep -c . || true)
[ "$ENTRY_COUNT" -gt 0 ] || die "备份 tar 无条目，中止删除：$TARBALL"
log "备份校验通过：$ENTRY_COUNT 个条目，大小 $(du -h "$TARBALL" | cut -f1)"

# ---------- 3. 存档数据库在线快照（主理人拍板：python3 + sqlite3 backup API，WAL 安全） ----------
# 绝不直接 cp db/wal/shm 三个文件（WAL 下会拷出撕裂快照）；线上存档本体只读不动。
DB_SRC="$BASE/data/game.db"
DB_SNAP="$BACKUP_DIR/game-db-pre-v22-$STAMP.db"
if [ -f "$DB_SRC" ]; then
  log "在线快照存档数据库 -> $DB_SNAP"
  python3 - "$DB_SRC" "$DB_SNAP" <<'PYEOF'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
try:  # 优先只读连接；若 WAL 处于需恢复状态导致 ro 打开失败，退回普通连接（backup API 自带锁协调）
    try:
        s = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
        s.execute("SELECT 1")
    except sqlite3.Error:
        s = sqlite3.connect(src)
    d = sqlite3.connect(dst)
    with d:
        s.backup(d)
    d.close(); s.close()
    print(f"[db-snapshot] OK: {dst}")
except Exception as e:
    print(f"[db-snapshot][FAIL] {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
  # 最小校验：文件 > 500KB 且 PRAGMA quick_check 返回 ok，失败立即中止（不删任何东西）
  SNAP_BYTES=$(wc -c < "$DB_SNAP")
  [ "$SNAP_BYTES" -gt 512000 ] || die "db 快照仅 $SNAP_BYTES 字节（应 >500KB），中止。"
  QUICK_CHECK=$(python3 - "$DB_SNAP" <<'PYEOF'
import sqlite3, sys
c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
print(c.execute("PRAGMA quick_check").fetchone()[0])
PYEOF
)
  [ "$QUICK_CHECK" = "ok" ] || die "db 快照 quick_check 返回 '$QUICK_CHECK'（应 ok），中止。"
  log "db 快照校验通过：$SNAP_BYTES 字节，quick_check=ok"
else
  warn "未找到 $DB_SRC，跳过 db 快照（正常情况不应出现，请人工确认！）"
fi

# ---------- 4. 逐个删除（存在才删，删除前再次过白名单守卫） ----------
for t in "${EXISTING[@]}"; do
  guard "$t"
  if [ -e "$t" ]; then
    rm -rf -- "$t"
    log "已删除：$t"
  else
    warn "删除前已消失（幂等跳过）：$t"
  fi
done

# ---------- 5. 结果核对输出 ----------
log "清理完成。当前占用与 webapp 文件清单如下（供人工核对）："
du -sh "$BASE"
find "$BASE/webapp" -type f | sort
log "备份保留于：$TARBALL（回滚：tar xzf $TARBALL -C $BASE）"
log "db 快照保留于：$DB_SNAP（应急恢复：先停服，用 sqlite3 校验后 cp 覆盖 data/game.db 再起服，须人工审批）"
