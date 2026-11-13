import assert from 'node:assert/strict';
import { copyFullValue } from '../../../src/components/p11/ProvenanceLedger';
const original = `0x${'1234567890abcdef'.repeat(4)}`;
let written = '';
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (value: string) => { written = value; } } } });
async function main() {
  assert.equal(await copyFullValue(original), true);
  assert.equal(written, original);
  console.log('凭证复制保留完整 66 字符原值通过');
}
void main();
