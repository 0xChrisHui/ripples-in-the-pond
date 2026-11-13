#!/usr/bin/env python3
"""只在本机/香港生成配置；不连接云端，也不安装或启动服务。"""
import argparse
import os
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--upstream', required=True, help='Vercel 独立目标，不填本站域名')
parser.add_argument('--output', required=True)
parser.add_argument('--secret-file', required=True, help='包含 64 位随机十六进制密钥的本地文件')
parser.add_argument('--cache', default='/var/cache/pond-edge')
parser.add_argument('--state', default='/var/lib/pond-edge')
parser.add_argument('--certificate', default='/etc/ssl/pond-edge/fullchain.pem')
parser.add_argument('--certificate-key', default='/etc/ssl/pond-edge/key.pem')
parser.add_argument('--ca-bundle', default='/etc/ssl/certs/ca-certificates.crt')
args = parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9.-]+(?::[0-9]+)?', args.upstream):
    parser.error('upstream 只填独立主机名或 IPv4，可带端口')
upstream_parts = args.upstream.lower().split(':', 1)
upstream_parts[0] = upstream_parts[0].rstrip('.')
if upstream_parts[0] in ('pond-ripple.xyz', 'edge-cn.pond-ripple.xyz'):
    parser.error('不能回源本站域名，防止解析形成循环')
args.upstream = ':'.join(upstream_parts)
secret = Path(args.secret_file).read_text().strip()
if not re.fullmatch(r'[0-9a-fA-F]{64}', secret):
    parser.error('密钥必须为 32 字节随机值的 64 位十六进制编码')
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
replacements = {
    '__CONFIG_DIR__': str(output), '__SECRET_INCLUDE__': str(output / 'edge-secret.conf'),
    '__UPSTREAM__': args.upstream, '__CACHE_DIR__': str(Path(args.cache).resolve()),
    '__STATE_DIR__': str(Path(args.state).resolve()), '__CERTIFICATE__': args.certificate,
    '__CERTIFICATE_KEY__': args.certificate_key, '__CA_BUNDLE__': args.ca_bundle,
}
for value in replacements.values():
    if re.search(r'[\s;{}"\n]', value):
        parser.error('配置路径/主机名不得包含空白或 nginx 指令分隔符')
source = Path(__file__).resolve().parent
for filename in ['nginx.conf.template', 'conf/common.conf', 'conf/audio.conf', 'conf/static.conf']:
    text = (source / filename).read_text(encoding='utf-8')
    for key, value in replacements.items():
        text = text.replace(key, value.replace('\\', '/'))
    target = output / ('nginx.conf' if filename.endswith('.template') else Path(filename).name)
    target.write_text(text, encoding='utf-8')
(output / 'edge-secret.conf').write_text('map "" $pond_proxy_secret { default "' + secret + '"; }\n')
os.chmod(output / 'edge-secret.conf', 0o600)
for path in [args.cache, args.state, str(Path(args.cache) / 'body'), str(Path(args.cache) / 'temp')]:
    Path(path).mkdir(parents=True, exist_ok=True)
print('已生成配置；尚未启动 nginx。输出目录：' + str(output))
