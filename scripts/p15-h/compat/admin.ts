import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  createPublicClient, getAddress, http, recoverTypedDataAddress,
  type Address, type Hex,
} from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  attachSignature, signatureMessage, validateCompatibilityManifest,
} from './contract';
import type { CompatibilityManifest, CompatibilityPayload } from './types';

export const DEFAULT_ADMIN_ROLE = `0x${'0'.repeat(64)}` as const;
const HAS_ROLE_ABI = [{
  type: 'function', name: 'hasRole', stateMutability: 'view',
  inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

const COMPAT_TYPES = {
  Compatibility: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'originalTokenURI', type: 'string' },
    { name: 'originalEvents', type: 'string' },
    { name: 'originalBase', type: 'string' },
    { name: 'originalSounds', type: 'string' },
    { name: 'effectiveSoundsDigest', type: 'bytes32' },
    { name: 'canonicalDigest', type: 'bytes32' },
    { name: 'publishedAt', type: 'string' },
    { name: 'roleBlockNumber', type: 'uint256' },
  ],
} as const;

function rpcUrl(): string {
  const value = [
    'OP_MAINNET_RPC_URL', 'ALCHEMY_OP_MAINNET_RPC_URL', 'MAINNET_RPC_URL',
    'ALCHEMY_RPC_URL', 'NEXT_PUBLIC_ALCHEMY_RPC_URL',
  ].map((name) => process.env[name]?.trim()).find(Boolean);
  if (!value) throw new Error('缺少 OP Mainnet RPC；签名与上传必须实时核验 admin role');
  return value;
}

export function loadAdminAccount(): PrivateKeyAccount {
  const configured = process.env.ADMIN_WALLET_PATH;
  if (!configured || !isAbsolute(configured)) throw new Error('ADMIN_WALLET_PATH 必须是仓库外绝对路径');
  const path = resolve(configured);
  const fromRoot = relative(process.cwd(), path);
  const insideRoot = fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
  if (insideRoot) throw new Error('ADMIN_WALLET_PATH 不得位于仓库内');
  const value = JSON.parse(readFileSync(path, 'utf8')) as { privateKey?: unknown };
  if (typeof value.privateKey !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value.privateKey)) {
    throw new Error('admin 钱包文件必须只通过 privateKey 提供 32-byte 私钥');
  }
  return privateKeyToAccount(value.privateKey as Hex);
}

export async function assertCurrentAdmin(
  account: Address,
  scoreContract: Address,
): Promise<{ blockNumber: bigint }> {
  const client = createPublicClient({ chain: optimism, transport: http(rpcUrl()) });
  const chainId = await client.getChainId();
  if (chainId !== 10) throw new Error(`admin role RPC 链错误：${chainId}`);
  const blockNumber = await client.getBlockNumber();
  const allowed = await client.readContract({
    address: getAddress(scoreContract), abi: HAS_ROLE_ABI, functionName: 'hasRole',
    args: [DEFAULT_ADMIN_ROLE, getAddress(account)], blockNumber,
  });
  if (!allowed) throw new Error(`${account} 在区块 ${blockNumber} 不持有 ScoreNFT DEFAULT_ADMIN_ROLE`);
  return { blockNumber };
}

function typedMessage(message: CompatibilityManifest['signature']['message']) {
  return {
    ...message,
    tokenId: BigInt(message.tokenId),
    roleBlockNumber: BigInt(message.roleBlockNumber),
  };
}

export async function signPayloadWithAccount(
  payload: CompatibilityPayload,
  account: PrivateKeyAccount,
  blockNumber: bigint,
): Promise<CompatibilityManifest> {
  const domain = {
    name: 'RipplesCompatibility' as const, version: '1' as const,
    chainId: payload.chainId, verifyingContract: getAddress(payload.scoreContract),
  };
  const message = await signatureMessage(payload, undefined, blockNumber.toString());
  const value = await account.signTypedData({
    domain, types: COMPAT_TYPES, primaryType: 'Compatibility', message: typedMessage(message),
  });
  return attachSignature(payload, {
    scheme: 'eip712', signer: account.address, value,
    adminRole: DEFAULT_ADMIN_ROLE, roleBlockNumber: blockNumber.toString(), domain, message,
  });
}

export async function signPayloadAsCurrentAdmin(
  payload: CompatibilityPayload,
): Promise<CompatibilityManifest> {
  const account = loadAdminAccount();
  const { blockNumber } = await assertCurrentAdmin(account.address, payload.scoreContract);
  return signPayloadWithAccount(payload, account, blockNumber);
}

export async function verifyManifestSignature(manifest: CompatibilityManifest): Promise<Address> {
  await validateCompatibilityManifest(manifest);
  const recovered = await recoverTypedDataAddress({
    domain: manifest.signature.domain,
    types: COMPAT_TYPES,
    primaryType: 'Compatibility',
    message: typedMessage(manifest.signature.message),
    signature: manifest.signature.value,
  });
  if (recovered.toLowerCase() !== manifest.signature.signer.toLowerCase()) {
    throw new Error('EIP-712 恢复地址与 signer 不一致');
  }
  return recovered;
}
