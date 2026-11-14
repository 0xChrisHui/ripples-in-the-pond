// 生产部署使用独立管理员，不能占用后台运营钱包的 nonce。
import '../../_env';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, encodeDeployData, encodeFunctionData,
  getContractAddress, http, keccak256, parseAbi, stringToHex, zeroHash, type Address, type Hex } from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const root = '.tmp/p23-atomic-live';
const ledgerPath = `${root}/chain-actions.json`;
const nft = '0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA' as Address;
const orchestrator = '0x406519962cDD1673D30fEcC13c4B6f7Af87Ba1dA' as Address;
const adminPath = process.env.ADMIN_WALLET_PATH;
assert.ok(adminPath, '必须配置仓库外管理员钱包');
const admin = privateKeyToAccount(JSON.parse(readFileSync(adminPath, 'utf8')).privateKey);
const operator = privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY as Hex).address;
assert.equal(admin.address, '0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722');
assert.notEqual(admin.address, operator);
const rpc = process.env.ALCHEMY_RPC_URL;
assert.ok(rpc && process.env.NEXT_PUBLIC_CHAIN_ID === '10', '只允许显式 OP 主网配置');
const client = createPublicClient({ chain: optimism, transport: http(rpc, { retryCount: 0, timeout: 15_000 }) });
const wallet = createWalletClient({ account: admin, chain: optimism, transport: http(rpc, { retryCount: 0 }) });
const role = keccak256(stringToHex('MINTER_ROLE'));
const abi = parseAbi(['function hasRole(bytes32,address) view returns(bool)',
  'function grantRole(bytes32,address)', 'function revokeRole(bytes32,address)',
  'function orchestrator() view returns(address)', 'function scoreNft() view returns(address)',
  'function mintScoreWithURI(address,bytes32,uint256,string) returns(uint256)']);
type Action = { hash: Hex; nonce: number; to?: Address; predictedAddress?: Address; confirmed?: boolean; block?: string };
const ledger: Record<string, Action> = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
const save = () => { mkdirSync(root, { recursive: true }); writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)); };
const hasRole = (address: Address, account: Address, r = role, blockNumber?: bigint) => client.readContract({ address, abi,
  functionName: 'hasRole', args: [r, account], blockNumber });
async function submit(name: string, data: Hex, to?: Address) {
  if (!ledger[name]) {
    assert.ok(process.argv.includes('--execute'), '未提供 --execute，不广播');
    const [latest, pending] = await Promise.all(['latest', 'pending'].map(blockTag =>
      client.getTransactionCount({ address: admin.address, blockTag: blockTag as 'latest' | 'pending' })));
    assert.equal(latest, pending, '管理员存在待确认交易，停止');
    const request = await wallet.prepareTransactionRequest({ account: admin, chain: optimism, to, data, nonce: latest });
    assert.ok(request.gas * (request.maxFeePerGas ?? request.gasPrice ?? 0n) < 200_000_000_000_000n,
      '单笔最坏执行费超过 0.0002 ETH，停止');
    const serializedTransaction = await wallet.signTransaction(request);
    const hash = keccak256(serializedTransaction);
    ledger[name] = { hash, nonce: latest, to,
      ...(!to ? { predictedAddress: getContractAddress({ from: admin.address, nonce: BigInt(latest) }) } : {}) };
    save(); // 广播前保存确定哈希；重启只确认同一哈希，不猜测重发。
    assert.equal(await wallet.sendRawTransaction({ serializedTransaction }), hash);
  }
  const receipt = await client.waitForTransactionReceipt({ hash: ledger[name].hash, timeout: 55_000 });
  assert.equal(receipt.status, 'success');
  ledger[name].confirmed = true; ledger[name].block = String(receipt.blockNumber); save();
  console.log(JSON.stringify({ action: name, ...ledger[name] }));
}
async function main() {
  assert.equal(await client.getChainId(), 10);
  assert.ok(await hasRole(nft, admin.address, zeroHash));
  assert.ok(await hasRole(orchestrator, admin.address, zeroHash));
  const action = process.argv[2];
  if (action === 'deploy') {
    const artifact = JSON.parse(readFileSync('contracts/out/AtomicScoreIssuer.sol/AtomicScoreIssuer.json', 'utf8'));
    await submit('deploy', encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode.object,
      args: [orchestrator, admin.address, operator] }));
  }
  const issuer = ledger.deploy?.predictedAddress;
  assert.ok(issuer && ledger.deploy.confirmed, '新合约尚未部署确认');
  assert.ok((await client.getCode({ address: issuer }))?.length);
  assert.equal((await client.readContract({ address: issuer, abi, functionName: 'orchestrator' })).toLowerCase(), orchestrator.toLowerCase());
  assert.equal((await client.readContract({ address: issuer, abi, functionName: 'scoreNft' })).toLowerCase(), nft.toLowerCase());
  assert.ok(await hasRole(issuer, admin.address, zeroHash)); assert.ok(await hasRole(issuer, operator));
  if (action === 'grant') {
    for (const [name, target] of [['grant-orchestrator', orchestrator], ['grant-nft', nft]] as const) {
      if (!await hasRole(target, issuer)) await submit(name, encodeFunctionData({ abi, functionName: 'grantRole', args: [role, issuer] }), target);
      assert.ok(await hasRole(target, issuer, role, ledger[name]?.block ? BigInt(ledger[name].block!) : undefined));
    }
  }
  if (action === 'revoke-legacy') {
    assert.ok(await hasRole(nft, issuer) && await hasRole(orchestrator, issuer));
    if (await hasRole(orchestrator, operator)) await submit('revoke-legacy', encodeFunctionData({ abi,
      functionName: 'revokeRole', args: [role, operator] }), orchestrator);
    assert.equal(await hasRole(orchestrator, operator, role, BigInt(ledger['revoke-legacy'].block!)), false);
  }
  console.log(JSON.stringify({ issuer, admin: admin.address, operator,
    issuerCanMint: await hasRole(orchestrator, issuer), issuerCanSetUri: await hasRole(nft, issuer),
    legacyOperatorCanMint: await hasRole(orchestrator, operator) }));
}
main().catch(e => { console.error(e.shortMessage ?? e.message?.split('\n')[0] ?? '部署失败'); process.exitCode = 1; });
