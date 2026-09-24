import assert from 'node:assert/strict';
import {
  LEGACY_SCORE_CHAIN_ID, LEGACY_SCORE_CONTRACT, assertProductionLegacyScoreConfig,
} from '../../../src/data/score/legacy-identity';

assert.equal(LEGACY_SCORE_CHAIN_ID, 10);
assert.equal(LEGACY_SCORE_CONTRACT.toLowerCase(), '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa');

const mainnet = {
  VERCEL_ENV: 'production', NEXT_PUBLIC_CHAIN_ID: '10',
  NEXT_PUBLIC_SCORE_NFT_ADDRESS: LEGACY_SCORE_CONTRACT,
};
assert.doesNotThrow(() => assertProductionLegacyScoreConfig(mainnet));
assert.throws(() => assertProductionLegacyScoreConfig({ ...mainnet, NEXT_PUBLIC_CHAIN_ID: '11155420' }));
assert.throws(() => assertProductionLegacyScoreConfig({ ...mainnet, NEXT_PUBLIC_SCORE_NFT_ADDRESS: '0x0000000000000000000000000000000000000000' }));
assert.doesNotThrow(() => assertProductionLegacyScoreConfig({ ...mainnet, VERCEL_ENV: 'development', NEXT_PUBLIC_CHAIN_ID: '11155420' }));

console.log('旧数字 Score 主网身份与正式部署配置门禁通过');
