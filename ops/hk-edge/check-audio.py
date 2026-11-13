#!/usr/bin/env python3
"""经 curl --resolve 检查公开音频，保留完整哈希和 Range 字节合同。"""
import argparse
import hashlib
import re
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('ip')
parser.add_argument('path')
parser.add_argument('sha256')
parser.add_argument('--full-first', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[0-9a-f]{64}', args.sha256):
    parser.error('需要原件的 SHA-256，不能跳过内容一致性检查')
with tempfile.TemporaryDirectory(prefix='pond-audio-') as temp:
    root = Path(temp)

    def get(range_value=None):
        command = ['curl', '--noproxy', '*', '--silent', '--show-error', '--connect-timeout', '5',
                   '--max-time', '120', '--resolve', 'pond-ripple.xyz:443:' + args.ip,
                   '-D', str(root / 'headers'), '-o', str(root / 'body')]
        if range_value:
            command += ['-H', 'Range: ' + range_value]
        subprocess.run(command + ['https://pond-ripple.xyz' + args.path], check=True)
        lines = (root / 'headers').read_text().splitlines()
        status = int(next(line for line in reversed(lines) if line.startswith('HTTP/')).split()[1])
        headers = {key.lower(): value.strip() for line in lines if ':' in line
                   for key, value in [line.split(':', 1)]}
        return status, headers, (root / 'body').read_bytes()

    def full():
        code, headers, body = get()
        assert code == 200, (code, headers)
        assert hashlib.sha256(body).hexdigest() == args.sha256, '完整音频 SHA-256 不一致'
        return body

    original = full() if args.full_first else None
    for attempt in range(2):
        code, headers, body = get('bytes=0-0')
        assert code == 206 and len(body) == 1, (code, headers)
        assert re.fullmatch(r'bytes 0-0/[0-9]+', headers.get('content-range', '')), headers
        if attempt == 1:
            assert headers.get('x-cache-status') == 'HIT', '第二次 Range 应命中同一分片'
    original = original if original is not None else full()
    for value, start, end in [('bytes=0-0', 0, 0),
                             ('bytes=-1000', max(0, len(original) - 1000), len(original) - 1)]:
        code, headers, body = get(value)
        assert code == 206 and body == original[start:end + 1], (value, code, headers)
    if len(original) > 1048700:
        code, headers, body = get('bytes=1048500-1048700')
        assert code == 206 and body == original[1048500:1048701], (code, headers)
    code, headers, body = get('bytes=' + str(len(original) + 100) + '-')
    assert code == 416, (code, headers)
    assert hashlib.sha256(full()).hexdigest() == args.sha256
print('音频 Range / 完整 GET / SHA-256 通过：' + args.path)
