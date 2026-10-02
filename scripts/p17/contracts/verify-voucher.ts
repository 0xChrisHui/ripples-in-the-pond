import assert from 'node:assert/strict';
import { keccak256, stringToHex, type Address, type Hex } from 'viem';
import { hashMaterialAuthorization, buildMaterialTypedData } from '../../../src/lib/material-mint/contract';
const authorization = { orderId: ('0x' + '11'.repeat(32)) as Hex, tokenId: 1n, amount: 1n,
  recipient: '0x000000000000000000000000000000000000cafe' as Address,
  tokenURIHash: keccak256(stringToHex('ar://' + 'T'.repeat(43))), deadline: 2000000000n };
const address = '0x0000000000000000000000000000000000000100';
const digest = hashMaterialAuthorization(31337, address, authorization);
assert.equal(digest, '0x1a0bb1015acd59e955283044e6b572d972690395e48dca5b3aaa9155876d525d');
assert.notEqual(digest, hashMaterialAuthorization(1, address, authorization));
assert.notEqual(digest, hashMaterialAuthorization(31337, address.replace('0100', '0101'), authorization));
assert.equal(buildMaterialTypedData(31337, address, authorization).domain.name, 'Ripples in the Pond Originals');
console.log(JSON.stringify({ scope: '公开本地签名向量，非生产政策', chainId: 31337, contract: address,
  authorization, digest }, (_, value) => typeof value === 'bigint' ? String(value) : value));
