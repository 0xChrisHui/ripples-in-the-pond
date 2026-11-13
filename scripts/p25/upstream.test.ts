import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('上游连续三次失败才降级，恢复自动清标记；磁盘/证书邮件去重', () => {
  const root = mkdtempSync(join(tmpdir(), 'pond-p25-upstream-'));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const tools: Record<string, string> = {
    flock: 'exit 0',
    curl: [
      'if [ "$SIM_FAIL" = 1 ]; then exit 22; fi',
      'while [ "$#" -gt 0 ]; do',
      'if [ "$1" = -D ]; then shift; printf "HTTP/1.1 200 OK\\r\\nx-pond-ip-source: edge\\r\\n" > "$1"; fi',
      'if [ "$1" = -o ]; then shift; printf "{}" > "$1"; fi',
      'shift', 'done',
    ].join('\n'),
    df: 'printf "Filesystem 1K-blocks Used Available Use%% Mounted\\nfixture 100 90 10 %s%% /\\n" "$SIM_DISK"',
    openssl: '[ "$SIM_CERT_BAD" != 1 ]',
    logger: 'printf "%s\\n" "$*" >> "$SIM_LOG"',
    mail: 'cat >> "$SIM_MAIL"',
  };
  for (const [name, body] of Object.entries(tools)) {
    writeFileSync(join(bin, name), '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 });
  }
  const env = { ...process.env, POND_STATE_DIR: root, POND_CACHE_DIR: root,
    POND_ALERT_EMAIL: 'fixture@example.invalid', SIM_LOG: join(root, 'log'), SIM_MAIL: join(root, 'mail'),
    SIM_DISK: '1', SIM_CERT_BAD: '0', SIM_FAIL: '1',
    PATH: bin + (process.platform === 'win32' ? ';' : ':') + process.env.PATH };
  const run = () => {
    const prepare = process.platform === 'win32' ? 'PATH="$(cygpath -u "$1"):$PATH"' : 'PATH="$1:$PATH"';
    const result = spawnSync('bash', ['--noprofile', '--norc', '-c', prepare + '; export PATH; source "$2"',
      'fixture', bin, resolve('ops/hk-edge/upstream-check.sh')], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  run(); run(); assert.equal(existsSync(join(root, 'upstream.failed')), false);
  run(); assert.equal(existsSync(join(root, 'upstream.failed')), true);
  env.SIM_FAIL = '0'; run();
  assert.equal(existsSync(join(root, 'upstream.failed')), false);
  assert.equal(existsSync(join(root, 'upstream.failures')), false);
  env.SIM_DISK = '81'; env.SIM_CERT_BAD = '1'; run();
  const delivered = readFileSync(join(root, 'mail'), 'utf8');
  assert.ok(delivered.includes('81%')); assert.ok(delivered.includes('14 天'));
  run(); assert.equal(readFileSync(join(root, 'mail'), 'utf8'), delivered);
});
