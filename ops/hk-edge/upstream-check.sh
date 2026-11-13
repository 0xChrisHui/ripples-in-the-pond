#!/usr/bin/env bash
# 每分钟由 systemd 启动；连续三次上游失败才影响本地健康检查。
set -euo pipefail
STATE_DIR=${POND_STATE_DIR:-/var/lib/pond-edge}
mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/check.lock"
flock -n 9 || exit 0
work=$(mktemp -d)
trap 'rm -f "$work/headers" "$work/body"; rmdir "$work"' EXIT
ok=0
if curl --noproxy '*' --silent --show-error --fail --connect-timeout 5 --max-time 20 \
    --resolve pond-ripple.xyz:443:127.0.0.1 -D "$work/headers" -o "$work/body" \
    https://pond-ripple.xyz/api/ping; then
  if tr -d '\r' < "$work/headers" | grep -qi '^x-pond-ip-source: edge$'; then ok=1; fi
fi
if [ "$ok" = 1 ]; then
  rm -f "$STATE_DIR/upstream.failed" "$STATE_DIR/upstream.failures"
else
  failures=0
  if [ -f "$STATE_DIR/upstream.failures" ]; then read -r failures < "$STATE_DIR/upstream.failures"; fi
  [[ "$failures" =~ ^[0-9]+$ ]] || failures=0
  failures=$((failures + 1))
  printf '%s\n' "$failures" > "$STATE_DIR/upstream.failures"
  if [ "$failures" -ge 3 ]; then
    touch "$STATE_DIR/upstream.failed"
    logger -p daemon.err 'pond-edge：上游连续三次不可用，健康端点已返回 503'
  fi
fi
# 日志报警始终可用；邮件收件人由服务器配置，不记录请求体或任何密钥。
alert() {
  local kind=$1 message=$2 last=0 now
  now=$(date +%s)
  if [ -f "$STATE_DIR/$kind.last-alert" ]; then read -r last < "$STATE_DIR/$kind.last-alert"; fi
  if [ $((now - last)) -lt 21600 ]; then return; fi
  logger -p daemon.warning "$message"
  if [ -n "${POND_ALERT_EMAIL:-}" ]; then
    printf '%s\n' "$message" | mail -s "pond-edge $kind" "$POND_ALERT_EMAIL"
  fi
  printf '%s\n' "$now" > "$STATE_DIR/$kind.last-alert"
}
disk=$(df -P "${POND_CACHE_DIR:-/var/cache/pond-edge}" | awk 'NR==2 {gsub(/%/,"",$5);print $5}')
inode=$(df -Pi "${POND_CACHE_DIR:-/var/cache/pond-edge}" | awk 'NR==2 {gsub(/%/,"",$5);print $5}')
if [ "$disk" -ge 80 ] || [ "$inode" -ge 80 ]; then
  alert disk "pond-edge：磁盘 ${disk}% / inode ${inode}% 达到 80% 阈值"
fi
cert=${POND_CERTIFICATE:-/etc/ssl/pond-edge/fullchain.pem}
if ! openssl x509 -in "$cert" -checkend 1209600 -noout >/dev/null 2>&1; then
  alert certificate 'pond-edge：证书不可读或将在 14 天内过期'
fi
