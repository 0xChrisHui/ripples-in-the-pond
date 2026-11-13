#!/usr/bin/env bash
# 只对明确指定的香港 IP 发公开 GET；不会写订单、停服务或修改健康标记。
set -euo pipefail
if [ "$#" -ne 5 ]; then
  echo '用法：edge-check.sh 香港IP 哈希静态路径 已核验媒体txid 媒体SHA256 仓库目录' >&2
  exit 2
fi
EDGE_IP=$1 STATIC_PATH=$2 MEDIA_ID=$3 MEDIA_SHA=$4 REPO=$5
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
[[ "$STATIC_PATH" == /_next/static/* ]] || exit 2
[[ "$MEDIA_ID" =~ ^[a-zA-Z0-9_-]{43}$ ]] || exit 2
work=$(mktemp -d)
trap 'rm -f "$work/headers" "$work/body"; rmdir "$work"' EXIT
get() {
  curl --noproxy '*' --silent --show-error --connect-timeout 5 --max-time 60 \
    --resolve "pond-ripple.xyz:443:$EDGE_IP" -D "$work/headers" -o "$work/body" \
    -w '%{http_code}' "$@"
}
for path in / /tracks/pond /tracks/archive; do
  for mode in regular rsc; do
    extra=(); [ "$mode" = rsc ] && extra=(-H 'RSC: 1')
    code=$(get "${extra[@]}" "https://pond-ripple.xyz$path")
    [ "$code" = 200 ] || { echo "$path HTTP=$code" >&2; exit 1; }
    if grep -qi '^X-Cache-Status:' "$work/headers"; then echo "动态路径误带缓存头：$path" >&2; exit 1; fi
  done
done
get "https://pond-ripple.xyz$STATIC_PATH" >/dev/null
code=$(get "https://pond-ripple.xyz$STATIC_PATH?probe=$(date +%s)")
[ "$code" = 200 ]
tr -d '\r' < "$work/headers" | grep -qi '^x-cache-status: HIT$'
[ "$(get https://pond-ripple.xyz/api/ping)" = 200 ]
tr -d '\r' < "$work/headers" | grep -qi '^x-pond-ip-source: edge$'
[ "$(get https://pond-ripple.xyz/_edge/health)" = 200 ]
[ "$(get -X POST "https://pond-ripple.xyz$STATIC_PATH")" = 405 ]
[ "$(get "https://pond-ripple.xyz/media/$(printf '0%.0s' {1..43})")" = 404 ]
if curl --noproxy '*' --silent --show-error --max-time 10 --resolve "pond-ripple.xyz:443:$EDGE_IP" \
    -H 'Host: unknown.invalid' -o /dev/null https://pond-ripple.xyz/; then
  echo '未知 Host 未被拒绝' >&2; exit 1
fi
track_sha=$(python3 - "$REPO" <<'PY'
import json, sys
from pathlib import Path
proof = json.loads((Path(sys.argv[1]) / 'src/lib/music-catalog/experience/audio-stream-proof.json').read_text())
print(next(row['sha256'] for row in proof['rows'] if row['path'] == '/tracks/No.1.mp3'))
PY
)
python3 "$SCRIPT_DIR/check-audio.py" "$EDGE_IP" "/tracks/No.1.mp3?v=$track_sha" "$track_sha"
python3 "$SCRIPT_DIR/check-audio.py" "$EDGE_IP" "/media/$MEDIA_ID" "$MEDIA_SHA" --full-first
echo '只读线路检查通过；人工放置健康标记、TLS续期与真实播放仍须单独验收。'
