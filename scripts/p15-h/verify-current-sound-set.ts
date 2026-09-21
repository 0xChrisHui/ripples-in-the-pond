// P15-H1：验证账本、真实 MP3、P9 identity 与旧 26 键档案均未漂移。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P9_EFFECTS } from '../../src/components/pond-gl-test3/p9/registry';
import {
  inspectSoundDirectory,
  sha256,
  validateSoundSetLedger,
  type SoundSetLedger,
} from './sound-set-ledger';

const root = process.cwd();
const ledgerPath = join(root, 'data', 'sound-sets', 'current-33.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as SoundSetLedger;
const observed = inspectSoundDirectory(root);
const errors = validateSoundSetLedger(ledger, observed, P9_EFFECTS.map(({ soundKey }) => soundKey));
const legacyFiles = [
  ['data/sounds-ar-map.json', '5c83f176785934aca0bf36f12ad195e4141c0e309e6c0e12ab8b2b5e8b480e3e'],
  ['data/sounds-map-ar.json', '13c9c018690ce5190b309e7f3405e2c2af3db4e49faceca2c7ca69bd05cf1cbd'],
] as const;

for (const [relativePath, expectedHash] of legacyFiles) {
  // Git 在不同系统可能切换 CRLF/LF；档案内容不变时 Gate 不能误报。
  const normalized = readFileSync(join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
  if (sha256(Buffer.from(normalized)) !== expectedHash) {
    errors.push(`旧 26 键档案发生变化：${relativePath}`);
  }
}

if (errors.length) throw new Error(`H1 Gate 失败：\n- ${errors.join('\n- ')}`);
console.log('✅ H1 Gate：33 个键、33 个 MP3、33 个 P9 identity 严格一一对应；旧 26 键档案未变');
