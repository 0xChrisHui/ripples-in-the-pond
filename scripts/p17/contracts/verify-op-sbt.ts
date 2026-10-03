import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLegacyOriginalDeployment, getMusicCatalog, getOriginalMintDeployment } from '../../../src/lib/music-catalog/asset-registry';
import { requireOpSbtTarget, selectMaterialJobContract, opSbtRequestKey } from '../../../src/lib/material-mint/op/target';
import { verifyOpSbtReceipt } from '../../../src/lib/material-mint/op/proof';
import { encodeFunctionData, encodeEventTopics, encodeAbiParameters, parseAbi, zeroAddress, type TransactionReceipt, type Hex, getAddress } from 'viem';

const track = getMusicCatalog().tracks[0];
const target = getOriginalMintDeployment(track.trackId, 10);
assert.equal(target?.status, 'ready', '新OP领取必须使用已核验SBT');
assert.equal(target?.contractAddress?.toLowerCase(), '0xa65c9308635c8dd068a314c189e8d77941a7e99c');
const legacy = getLegacyOriginalDeployment(track.trackId)!;
assert.equal(legacy.status, 'ready');
assert.notEqual(legacy.contractAddress, target?.contractAddress);
assert.throws(() => requireOpSbtTarget(track.trackId, 'off', true), /OP_SBT_DISABLED/);
assert.throws(() => requireOpSbtTarget(track.trackId, 'live', false), /OP_SBT_DISABLED/);
assert.equal(requireOpSbtTarget(track.trackId, 'live', true).contractAddress.toLowerCase(), target?.contractAddress?.toLowerCase());
assert.equal(selectMaterialJobContract(null, legacy.contractAddress!, target).toLowerCase(), legacy.contractAddress);
assert.throws(() => selectMaterialJobContract(legacy.contractAddress, legacy.contractAddress!, target));
assert.throws(() => selectMaterialJobContract('坏快照', legacy.contractAddress!, legacy));
const fixture = { ...legacy, contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' };
assert.equal(selectMaterialJobContract(fixture.contractAddress, legacy.contractAddress!, fixture).toLowerCase(), fixture.contractAddress);
assert.throws(() => selectMaterialJobContract(legacy.contractAddress, legacy.contractAddress!, fixture));
assert.notEqual(opSbtRequestKey('user', fixture.contractAddress, '1'), opSbtRequestKey('user', legacy.contractAddress!, '1'));
assert.equal(getMusicCatalog().revision, JSON.parse(readFileSync('public/music-catalog/catalog.v1.json', 'utf8')).revision);
const abi = parseAbi(['function mint(address to,uint256 id,uint256 amount,bytes data)',
  'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)']);
const recipient = `0x${'22'.repeat(20)}` as const, operator = `0x${'33'.repeat(20)}` as const, hash = `0x${'ab'.repeat(32)}` as Hex;
const job = { material_contract_address: fixture.contractAddress, recipient_address: recipient, token_id: 1 };
const transaction = { hash, from: operator, to: fixture.contractAddress as Hex, value: 0n,
  input: encodeFunctionData({ abi, functionName: 'mint', args: [recipient, 1n, 1n, '0x'] }) };
const log = { address: transaction.to, topics: encodeEventTopics({ abi, eventName: 'TransferSingle',
  args: { operator, from: zeroAddress, to: recipient } }), data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [1n, 1n]) };
const receipt = { status: 'success', transactionHash: hash, logs: [log] } as unknown as TransactionReceipt;
assert.doesNotThrow(() => verifyOpSbtReceipt(job, receipt, transaction));
assert.throws(() => verifyOpSbtReceipt(job, { ...receipt, logs: [] }, transaction));
assert.throws(() => verifyOpSbtReceipt(job, receipt, { ...transaction, value: 1n }));
assert.throws(() => verifyOpSbtReceipt(job, receipt, { ...transaction, to: getAddress(legacy.contractAddress!) }));
assert.throws(() => verifyOpSbtReceipt({ ...job, recipient_address: operator }, receipt, transaction));
assert.throws(() => verifyOpSbtReceipt({ ...job, token_id: 2 }, receipt, transaction));
console.log('OP新SBT：真实目标/关闭开关拒绝、旧NULL兼容、冻结目标拒伪造、队列身份分离、C2一致，通过');
