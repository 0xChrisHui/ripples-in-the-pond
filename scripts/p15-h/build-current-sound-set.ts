// P15-H1：只从当前 33 个真实 MP3 首次生成版本化账本。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { VALID_SOUND_KEYS } from '../../src/lib/sound-set';
import {
  buildSoundSetLedger,
  validateSoundSetLedger,
  type SoundSetLedger,
} from './sound-set-ledger';

const root = process.cwd();
const output = join(root, 'data', 'sound-sets', 'current-33.json');

const ledger = buildSoundSetLedger(root);
if (existsSync(output)) {
  const existing = JSON.parse(readFileSync(output, 'utf8')) as SoundSetLedger;
  const errors = validateSoundSetLedger(existing, ledger.entries, VALID_SOUND_KEYS);
  if (errors.length) {
    throw new Error(`current-33 已存在且身份不同，请创建新版本：\n- ${errors.join('\n- ')}`);
  }
  console.log(`✅ 现有 33 键声音账本身份一致：${output}`);
  process.exit(0);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`✅ 已生成 ${ledger.entries.length} 键声音账本：${output}`);
