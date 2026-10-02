import { normalizeContract, normalizeTokenId } from './identity';

export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const arUri = (value: unknown): value is string => typeof value === 'string'
  && /^ar:\/\/[a-zA-Z0-9_-]{43}(?:\/[a-zA-Z0-9_.-]+)*$/.test(value)
  && !value.split('/').some((part) => part === '..' || part === '.');
export const decimal = (value: unknown): boolean => typeof value === 'string' && /^[1-9]\d*$/.test(value);
export function address(value: unknown): boolean {
  try { return typeof value === 'string' && normalizeContract(value) === value; } catch { return false; }
}
export function token(value: unknown): boolean {
  try { return typeof value === 'string' && normalizeTokenId(value) === value; } catch { return false; }
}
export function proof(value: unknown): boolean {
  return object(value) && typeof value.source === 'string' && value.source.length > 0
    && ['bytecode', 'standard', 'uri', 'media'].every((key) => typeof value[key] === 'boolean')
    && (value.blockNumber === null || decimal(value.blockNumber))
    && (value.verifiedAt === null || typeof value.verifiedAt === 'string')
    && (value.reason === null || typeof value.reason === 'string');
}
export function proofReady(value: unknown): boolean {
  return proof(value) && object(value) && value.bytecode === true && value.standard === true
    && value.uri === true && value.media === true && decimal(value.blockNumber);
}
export function archive(value: unknown): boolean {
  if (!object(value) || !['not_planned', 'awaiting_input', 'pending', 'confirmed', 'unknown'].includes(String(value.state))) return false;
  if (!['recipient', 'amount', 'txHash', 'blockNumber', 'blockHash', 'logIndex', 'verifiedAt', 'proof'].every((key) => key in value)) return false;
  if (value.recipient !== null && !address(value.recipient)) return false;
  if (value.amount !== null && !decimal(value.amount)) return false;
  if (value.txHash !== null && (typeof value.txHash !== 'string' || !/^0x[0-9a-f]{64}$/.test(value.txHash))) return false;
  if (value.blockNumber !== null && !decimal(value.blockNumber)) return false;
  if (value.blockHash !== null && (typeof value.blockHash !== 'string' || !/^0x[0-9a-f]{64}$/.test(value.blockHash))) return false;
  if (value.logIndex !== null && (!Number.isSafeInteger(value.logIndex) || Number(value.logIndex) < 0)) return false;
  if (value.verifiedAt !== null && typeof value.verifiedAt !== 'string') return false;
  if (value.proof !== null && typeof value.proof !== 'string') return false;
  return value.state !== 'confirmed' || ['recipient', 'amount', 'txHash', 'blockNumber', 'blockHash', 'logIndex', 'verifiedAt', 'proof']
    .every((key) => value[key] !== null && value[key] !== '');
}
