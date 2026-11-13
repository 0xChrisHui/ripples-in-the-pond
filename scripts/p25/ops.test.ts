import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('配置生成器拒绝本站与 edge-cn 的尾点/大小写变体', () => {
  const root = mkdtempSync(join(tmpdir(), 'pond-p25-origin-'));
  const secret = join(root, 'secret'); writeFileSync(secret, 'a'.repeat(64));
  for (const host of ['pond-ripple.xyz', 'POND-RIPPLE.XYZ.', 'edge-cn.pond-ripple.xyz.']) {
    const result = spawnSync(process.env.POND_PYTHON ?? 'python', ['ops/hk-edge/render.py', '--upstream', host,
      '--output', join(root, 'output'), '--secret-file', secret], {
      encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    assert.notEqual(result.status, 0, host);
    assert.ok(result.stderr.includes('不能回源本站域名'), result.stderr);
  }
});

test('静态文件返回404必须立即终止 edge-check，不能继续进入其他验收', () => {
  const root = mkdtempSync(join(tmpdir(), 'pond-p25-check-'));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const log = join(root, 'calls');
  const body = [
    '#!/usr/bin/env bash', 'url="${!#}"', 'printf "%s\\n" "$url" >> "$SIM_LOG"',
    'headers=""', 'while [ "$#" -gt 0 ]; do',
    'if [ "$1" = -D ]; then shift; headers=$1; fi', 'shift', 'done',
    'code=200; case "$url" in */_next/static/*) code=404;; esac',
    'if [ -n "$headers" ]; then printf "HTTP/1.1 %s OK\\r\\n\\r\\n" "$code" > "$headers"; fi',
    'printf "%s" "$code"',
  ].join('\n');
  writeFileSync(join(bin, 'curl'), body, { mode: 0o755 });
  const prepare = process.platform === 'win32' ? 'PATH="$(cygpath -u "$1"):$PATH"' : 'PATH="$1:$PATH"';
  const result = spawnSync('bash', ['--noprofile', '--norc', '-c',
    prepare + '; export PATH; source "$2" 192.0.2.1 /_next/static/test.js ' + 'a'.repeat(43) + ' ' + 'b'.repeat(64) + ' .',
    'fixture', bin, resolve('ops/hk-edge/edge-check.sh')], { env: { ...process.env, SIM_LOG: log }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.ok(!readFileSync(log, 'utf8').includes('/api/ping'));
});
