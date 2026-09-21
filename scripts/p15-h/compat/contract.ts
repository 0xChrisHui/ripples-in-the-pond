import {
  canonicalizeJson, sha256Hex, type JsonValue,
} from '../../../src/lib/score-package';
import type {
  CompatibilityManifest, CompatibilityPayload, CompatibilitySignature, CompatibilitySource,
} from './types';
import { COMPAT_SCHEMA } from './types';

const HASH = /^[0-9a-f]{64}$/;
const SIGNATURE = /^0x[0-9a-fA-F]{130}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DEFAULT_ADMIN_ROLE = `0x${'0'.repeat(64)}`;

export function buildPayload(
  source: CompatibilitySource,
  identity: { chainId: number; scoreContract: `0x${string}` },
  publishedAt: string,
): CompatibilityPayload {
  if (Number.isNaN(Date.parse(publishedAt)) || !publishedAt.endsWith('Z')) {
    throw new Error('publishedAt 必须是 UTC ISO 时间');
  }
  return {
    schema: COMPAT_SCHEMA,
    chainId: identity.chainId,
    scoreContract: identity.scoreContract,
    tokenId: source.tokenId,
    originalTokenURI: source.tokenUri,
    original: {
      events: `ar://${source.refs.events}`,
      base: `ar://${source.refs.base}`,
      sounds: `ar://${source.refs.sounds}`,
    },
    effectiveSounds: source.effectiveSounds,
    publishedAt,
    resolution: {
      soundSet: source.soundSet,
      usedKeys: source.usedKeys,
      changes: source.changes,
      reason: source.tokenId === 1
        ? 'Preserve the legacy sound identities used when Score #1 was recorded.'
        : 'Restore every used key to the current-33 identities active when this Score was recorded.',
    },
  };
}

export async function compatibilityDigest(payload: CompatibilityPayload): Promise<string> {
  return sha256Hex(canonicalizeJson(payload as unknown as JsonValue));
}

export async function effectiveSoundsDigest(payload: CompatibilityPayload): Promise<`0x${string}`> {
  const digest = await sha256Hex(canonicalizeJson(payload.effectiveSounds as unknown as JsonValue));
  return `0x${digest}`;
}

export async function signatureMessage(
  payload: CompatibilityPayload,
  digest?: string,
  roleBlockNumber = '0',
): Promise<CompatibilitySignature['message']> {
  const resolvedDigest = digest ?? await compatibilityDigest(payload);
  return {
    tokenId: String(payload.tokenId), originalTokenURI: payload.originalTokenURI,
    originalEvents: payload.original.events, originalBase: payload.original.base,
    originalSounds: payload.original.sounds, effectiveSoundsDigest: await effectiveSoundsDigest(payload),
    canonicalDigest: `0x${resolvedDigest}`, publishedAt: payload.publishedAt, roleBlockNumber,
  };
}

export async function attachSignature(
  payload: CompatibilityPayload,
  signature: CompatibilitySignature,
): Promise<CompatibilityManifest> {
  const digest = await compatibilityDigest(payload);
  if (signature.message.canonicalDigest !== `0x${digest}`) throw new Error('签名消息 digest 不匹配');
  return { ...payload, canonicalDigest: digest, signature };
}

export function payloadFromManifest(manifest: CompatibilityManifest): CompatibilityPayload {
  const { canonicalDigest, signature, ...payload } = manifest;
  void canonicalDigest;
  void signature;
  return payload;
}

export async function validateCompatibilityManifest(manifest: CompatibilityManifest): Promise<void> {
  const payload = payloadFromManifest(manifest);
  if (payload.schema !== COMPAT_SCHEMA || !Number.isSafeInteger(payload.chainId) || payload.chainId < 1
    || !ADDRESS.test(payload.scoreContract) || !Number.isSafeInteger(payload.tokenId) || payload.tokenId < 1
    || !HASH.test(manifest.canonicalDigest) || !SIGNATURE.test(manifest.signature.value)
    || !ADDRESS.test(manifest.signature.signer) || manifest.signature.scheme !== 'eip712'
    || manifest.signature.adminRole !== DEFAULT_ADMIN_ROLE) {
    throw new Error('compatibility manifest 基础结构无效');
  }
  const keys = Object.keys(payload.effectiveSounds);
  if (JSON.stringify(keys) !== JSON.stringify(payload.resolution.usedKeys)) {
    throw new Error('effectiveSounds 必须精确覆盖 usedKeys 并保持顺序');
  }
  for (const key of keys) {
    const sound = payload.effectiveSounds[key as keyof typeof payload.effectiveSounds];
    if (!sound || !/^[A-Za-z0-9_-]{43}$/.test(sound.arTxId)
      || !HASH.test(sound.sha256) || !Number.isSafeInteger(sound.bytes)
      || sound.bytes <= 0 || sound.mime !== 'audio/mpeg') throw new Error(`声音 identity 无效：${key}`);
  }
  const digest = await compatibilityDigest(payload);
  if (digest !== manifest.canonicalDigest) throw new Error('compatibility canonical digest mismatch');
  const expectedMessage = await signatureMessage(payload, digest, manifest.signature.roleBlockNumber);
  if (canonicalizeJson(expectedMessage as unknown as JsonValue)
    !== canonicalizeJson(manifest.signature.message as unknown as JsonValue)) {
    throw new Error('EIP-712 message 与 manifest payload 不一致');
  }
  const domain = manifest.signature.domain;
  if (domain.name !== 'RipplesCompatibility' || domain.version !== '1'
    || domain.chainId !== payload.chainId
    || domain.verifyingContract.toLowerCase() !== payload.scoreContract.toLowerCase()) {
    throw new Error('EIP-712 domain 与 ScoreNFT 身份不一致');
  }
}

export function serializeCompatibilityManifest(manifest: CompatibilityManifest): Buffer {
  return Buffer.from(canonicalizeJson(manifest as unknown as JsonValue), 'utf8');
}
