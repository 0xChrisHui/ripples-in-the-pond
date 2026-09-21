import assert from 'node:assert/strict';
import { VALID_SOUND_KEYS } from '../../src/lib/sound-set';
import {
  buildSoundSetLedger,
  decodeMp3,
  validateSoundSetLedger,
  type SoundSetEntry,
} from './sound-set-ledger';

const ledger = buildSoundSetLedger(process.cwd());
const observed = ledger.entries.map((entry) => ({ ...entry }));
const p9Keys = [...VALID_SOUND_KEYS];

assert.deepEqual(validateSoundSetLedger(ledger, observed, p9Keys), []);

function expectError(
  mutateLedger: (entries: SoundSetEntry[]) => void,
  mutateObserved: (entries: SoundSetEntry[]) => void,
  keys: string[],
  fragment: string,
) {
  const ledgerEntries = ledger.entries.map((entry) => ({ ...entry }));
  const localEntries = observed.map((entry) => ({ ...entry }));
  mutateLedger(ledgerEntries);
  mutateObserved(localEntries);
  const errors = validateSoundSetLedger({ ...ledger, entries: ledgerEntries }, localEntries, keys);
  assert(errors.some((error) => error.includes(fragment)), `未捕获：${fragment}`);
}

expectError((entries) => entries.push({ ...entries[0] }), () => undefined, p9Keys, '重复键');
expectError(() => undefined, (entries) => entries.pop(), p9Keys, '缺少声音文件');
expectError(() => undefined, (entries) => { entries[0].sha256 = '0'.repeat(64); }, p9Keys, 'hash 漂移');
expectError(() => undefined, () => undefined, p9Keys.slice(1), 'P9 声音键映射有缺口');
assert.throws(() => decodeMp3(Buffer.from('not an mp3')), /没有可解码帧/);

console.log('✅ H1 单元 Gate：重复键、缺文件、hash 漂移、无法解码、P9 缺口均被拒绝');
