#!/usr/bin/env bash
# 清单仅消费已核验对象，绝不枚举任意上游或上传新文件。
set -euo pipefail
if [ "$#" -ne 3 ]; then echo '用法：edge-warm.sh 香港IP 仓库目录 Blob对象清单JSON' >&2; exit 2; fi
EDGE_IP=$1 REPO=$2 INVENTORY=$3
list=$(mktemp)
trap 'rm -f "$list"' EXIT
python3 - "$REPO" "$INVENTORY" > "$list" <<'PY'
import json, re, sys
from pathlib import Path
repo = Path(sys.argv[1])
tracks = json.loads((repo / 'src/lib/music-catalog/data/tracks-source.json').read_text())
proof = json.loads((repo / 'src/lib/music-catalog/experience/audio-stream-proof.json').read_text())
track_ids = {track['id'] for track in tracks}
for row in proof['rows']:
    assert row['trackId'] in track_ids and re.fullmatch(r'/tracks/No\.[0-9]+\.mp3', row['path'])
    assert re.fullmatch(r'[0-9a-f]{64}', row['sha256'])
    print(row['path'] + '?v=' + row['sha256'])
inventory = json.loads(Path(sys.argv[2]).read_text())
rows = inventory.get('results', []) if isinstance(inventory, dict) else inventory
assert rows, '请先完成 Blob 现有对象盘点，不使用空清单'
for row in rows:
    txid = row['arTxId']
    assert re.fullmatch(r'[a-zA-Z0-9_-]{43}', txid)
    print('/media/' + txid)
PY
while IFS= read -r path; do
  curl --noproxy '*' --silent --show-error --fail --connect-timeout 5 --max-time 120 \
    --resolve "pond-ripple.xyz:443:$EDGE_IP" -o /dev/null "https://pond-ripple.xyz$path"
done < "$list"
echo '已按清单完整预热；未改变 DNS 或镜像环境变量。'
