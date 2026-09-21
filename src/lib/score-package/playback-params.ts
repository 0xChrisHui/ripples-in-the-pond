import type { ArweaveRef, ScorePlaybackReference } from './types';

const TX_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LEGACY_PARAMS = ['events', 'base', 'sounds'] as const;
const ALL_PARAMS = new Set([...LEGACY_PARAMS, 'package']);

function arweaveRef(value: string | null, label: string): ArweaveRef {
  if (!value?.startsWith('ar://') || !TX_ID_PATTERN.test(value.slice(5))) {
    throw new Error(`${label} 必须是 ar://<43 位 tx id>`);
  }
  return value as ArweaveRef;
}

function requireUnique(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name);
  if (values.length > 1) throw new Error(`${name} 参数不得重复`);
  return values[0] ?? null;
}

/** Decoder 查询参数只允许 legacy 三参数或单一 package，二者不得混用。 */
export function parseScorePlaybackParams(params: URLSearchParams): ScorePlaybackReference {
  const names = [...params.keys()];
  const unknown = names.find((name) => !ALL_PARAMS.has(name));
  if (unknown) throw new Error(`不支持的播放参数：${unknown}`);

  const packageValue = requireUnique(params, 'package');
  const hasLegacy = LEGACY_PARAMS.some((name) => params.has(name));
  if (packageValue !== null) {
    if (hasLegacy) throw new Error('package 与 legacy 三参数不得混用');
    return { kind: 'package', packageRef: arweaveRef(packageValue, 'package') };
  }

  const values = Object.fromEntries(LEGACY_PARAMS.map((name) => (
    [name, requireUnique(params, name)]
  )));
  if (LEGACY_PARAMS.some((name) => values[name] === null)) {
    throw new Error('legacy 播放必须同时提供 events、base、sounds');
  }
  return {
    kind: 'legacy',
    eventsRef: arweaveRef(values.events, 'events'),
    baseAudioRef: arweaveRef(values.base, 'base'),
    soundsMapRef: arweaveRef(values.sounds, 'sounds'),
  };
}

