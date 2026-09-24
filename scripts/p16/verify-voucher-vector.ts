import assert from 'node:assert/strict';
import { hashTypedData, keccak256, stringToHex } from 'viem';
import {
  ETHEREUM_SCORE_NAME,
  ETHEREUM_SCORE_VERSION,
  MINT_AUTHORIZATION_TYPES,
} from '../../src/lib/self-mint/ethereum-score-contract';

const TOKEN_URI = 'ar://TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT';
const TOKEN_URI_HASH = '0xd7fdb006ca39dfbe068b28fed9c091b6a2da8810c16b5685bd616cdd876c19b2';
const EXPECTED_DIGEST = '0x8c42874f07894a0a960ec49fb948d7d68e25c521745df8e8824d64acda364041';

const digest = hashTypedData({
  domain: {
    name: ETHEREUM_SCORE_NAME,
    version: ETHEREUM_SCORE_VERSION,
    chainId: 31_337,
    verifyingContract: '0x1111111111111111111111111111111111111111',
  },
  types: MINT_AUTHORIZATION_TYPES,
  primaryType: 'MintAuthorization',
  message: {
    orderId: '0x0000000000000000000000000000000000000000000000000000000000001234',
    tokenId: 42n,
    recipient: '0x2222222222222222222222222222222222222222',
    tokenURIHash: TOKEN_URI_HASH,
    deadline: 2_000_000_000n,
  },
});

assert.equal(keccak256(stringToHex(TOKEN_URI)), TOKEN_URI_HASH);
assert.equal(digest, EXPECTED_DIGEST);
console.log('P16-C viem EIP-712 固定向量验证通过');
