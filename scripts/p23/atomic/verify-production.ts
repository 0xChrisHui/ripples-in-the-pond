import '../../_env';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, http, parseAbi, keccak256, stringToHex, zeroHash, type Address, type Hex } from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const ledger = JSON.parse(readFileSync('.tmp/p23-atomic-live/chain-actions.json', 'utf8'));
  const issuer = ledger.deploy.predictedAddress as Address;
  const nft = '0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA' as Address;
  const orchestrator = '0x406519962cDD1673D30fEcC13c4B6f7Af87Ba1dA' as Address;
  const admin = '0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722' as Address;
  const operator = privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY as Hex).address;
  const client = createPublicClient({ chain: optimism, transport: http(process.env.ALCHEMY_RPC_URL, { retryCount: 0 }) });
  assert.equal(await client.getChainId(), 10);
  const abi = parseAbi(['function hasRole(bytes32,address) view returns(bool)',
    'function tokenURI(uint256) view returns(string)', 'function ownerOf(uint256) view returns(address)',
    'function mint(address) returns(uint256)', 'function mintScore(address,bytes32) returns(uint256)',
    'function mintScoreWithURI(address,bytes32,uint256,string) returns(uint256)',
    'function tokenIdByOrderId(bytes32) view returns(uint256)']);
  const role = keccak256(stringToHex('MINTER_ROLE'));
  for (const [address, account, r, expected] of [[issuer, admin, zeroHash, true], [issuer, operator, role, true],
    [nft, issuer, role, true], [orchestrator, issuer, role, true], [orchestrator, operator, role, false]] as const) {
    assert.equal(await client.readContract({ address, abi, functionName: 'hasRole', args: [r, account] }), expected);
  }
  const artifact = JSON.parse(readFileSync('contracts/out/AtomicScoreIssuer.sol/AtomicScoreIssuer.json', 'utf8'));
  const code = await client.getCode({ address: issuer }); assert.ok(code);
  const actual = Buffer.from(code.slice(2), 'hex'), built = Buffer.from(artifact.deployedBytecode.object.slice(2), 'hex');
  for (const refs of Object.values(artifact.deployedBytecode.immutableReferences) as { start: number; length: number }[][]) {
    for (const { start, length } of refs) { actual.fill(0, start, start + length); built.fill(0, start, start + length); }
  }
  assert.deepEqual(actual, built, '链上运行代码必须与本次编译完全一致（固定地址另行读回）');
  const { result: candidate } = await client.simulateContract({ address: nft, abi, functionName: 'mint', args: [operator], account: issuer });
  const uri = await client.readContract({ address: nft, abi, functionName: 'tokenURI', args: [11n] });
  const order = keccak256(stringToHex('P23 production simulation only 2026-11-14'));
  assert.equal(await client.readContract({ address: orchestrator, abi, functionName: 'tokenIdByOrderId', args: [order] }), 0n);
  assert.equal((await client.simulateContract({ address: issuer, abi, functionName: 'mintScoreWithURI',
    args: [operator, order, candidate, uri], account: operator })).result, candidate);
  await assert.rejects(client.simulateContract({ address: orchestrator, abi, functionName: 'mintScore',
    args: [operator, order], account: operator }));
  assert.equal(await client.readContract({ address: orchestrator, abi, functionName: 'tokenIdByOrderId', args: [order] }), 0n);
  await assert.rejects(client.readContract({ address: nft, abi, functionName: 'ownerOf', args: [candidate] }));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: flag, error } = await db.from('system_kv').select('value').eq('key', 'score-atomic:enabled').single();
  assert.equal(error, null); assert.equal(flag.value, 'true');
  const response = await fetch('https://pond-ripple.xyz/api/cron/process-score-queue', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(40_000),
  });
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.issuance.protocol, 'atomic-v1'); assert.equal(body.issuance.issuer.toLowerCase(), issuer.toLowerCase());
  const proof = { at: new Date().toISOString(), chainId: 10, issuer, nft, orchestrator,
    runtimeMatchesBuild: true, grantsVerified: true, legacyOperatorRevoked: true, nextTokenId: String(candidate),
    atomicSimulation: 'success', legacySimulation: 'reverted', simulationCreatedNoNft: true,
    productionCron: body, activation: flag.value };
  writeFileSync('reviews/evidence/p23-atomic-live/production-proof.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
}
main().catch(e => { console.error(e.shortMessage ?? e.message?.split('\n')[0] ?? '生产核验失败'); process.exitCode = 1; });
