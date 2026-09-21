import { canonicalizeJson, sha256Hex, type JsonValue } from './canonical-json';
import {
  SCORE_PACKAGE_MAX_BYTES,
  SCORE_PACKAGE_RESOURCE_ROLES,
  SCORE_PACKAGE_SCHEMA,
  type ScorePackageResource,
  type ScorePackageResourceMime,
  type ScorePackageResourceRole,
  type ScorePackageV3,
} from './types';

const TX_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
const RESOURCE_KEYS = ['arTxId', 'sha256', 'bytes', 'mime'] as const;
const EXPECTED_MIMES: Readonly<Record<ScorePackageResourceRole, readonly ScorePackageResourceMime[]>> = {
  events: ['application/json'],
  base: ['audio/mpeg'],
  soundSet: ['application/json'],
  decoder: ['text/html', 'text/html; charset=utf-8'],
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} 字段必须精确为 ${wanted.join(',')}`);
  }
}

function parseResource(
  value: unknown,
  role: ScorePackageResourceRole,
): ScorePackageResource<ScorePackageResourceMime> {
  const input = record(value, `resources.${role}`);
  assertExactKeys(input, RESOURCE_KEYS, `resources.${role}`);
  if (typeof input.arTxId !== 'string' || !TX_ID_PATTERN.test(input.arTxId)) {
    throw new Error(`resources.${role}.arTxId 必须是 43 位 Arweave tx id`);
  }
  if (typeof input.sha256 !== 'string' || !SHA256_PATTERN.test(input.sha256)) {
    throw new Error(`resources.${role}.sha256 必须是 64 位小写 hex`);
  }
  if (!Number.isSafeInteger(input.bytes) || (input.bytes as number) <= 0) {
    throw new Error(`resources.${role}.bytes 必须是正安全整数`);
  }
  if (typeof input.mime !== 'string'
    || !EXPECTED_MIMES[role].includes(input.mime as ScorePackageResourceMime)) {
    throw new Error(`resources.${role}.mime 与角色不匹配`);
  }
  return input as ScorePackageResource<ScorePackageResourceMime>;
}

/** 严格 schema：拒绝扩展字段，防止签名/哈希语义产生分叉。 */
export function parseScorePackageV3(value: unknown): ScorePackageV3 {
  const input = record(value, 'score package');
  assertExactKeys(input, ['schema', 'queueId', 'contentId', 'resources'], 'score package');
  if (input.schema !== SCORE_PACKAGE_SCHEMA) throw new Error('score package schema 不是 v3');
  if (typeof input.queueId !== 'string' || !UUID_PATTERN.test(input.queueId)) {
    throw new Error('score package queueId 必须是 UUID');
  }
  if (typeof input.contentId !== 'string' || !CONTENT_ID_PATTERN.test(input.contentId)) {
    throw new Error('score package contentId 格式无效');
  }

  const resourceInput = record(input.resources, 'resources');
  assertExactKeys(resourceInput, SCORE_PACKAGE_RESOURCE_ROLES, 'resources');
  const resources = Object.fromEntries(SCORE_PACKAGE_RESOURCE_ROLES.map((role) => (
    [role, parseResource(resourceInput[role], role)]
  ))) as unknown as ScorePackageV3['resources'];
  const txIds = SCORE_PACKAGE_RESOURCE_ROLES.map((role) => resources[role].arTxId);
  if (new Set(txIds).size !== txIds.length) throw new Error('四个资源角色必须使用不同 Arweave tx id');
  return { schema: SCORE_PACKAGE_SCHEMA, queueId: input.queueId, contentId: input.contentId, resources };
}

export function serializeScorePackageV3(value: unknown): string {
  const parsed = parseScorePackageV3(value);
  const canonical = canonicalizeJson(parsed as unknown as JsonValue);
  if (new TextEncoder().encode(canonical).byteLength > SCORE_PACKAGE_MAX_BYTES) {
    throw new Error('score package 超过 64KB');
  }
  return canonical;
}

export async function hashScorePackageV3(value: unknown): Promise<string> {
  return sha256Hex(serializeScorePackageV3(value));
}

export async function verifyScorePackageResource(
  resource: ScorePackageResource<ScorePackageResourceMime>,
  bytes: Uint8Array | ArrayBuffer,
): Promise<void> {
  const actual = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes);
  if (actual.byteLength !== resource.bytes) throw new Error('永久资源字节数不匹配');
  if (await sha256Hex(actual) !== resource.sha256) throw new Error('永久资源 SHA-256 不匹配');
}

