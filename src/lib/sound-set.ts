/** 当前可录制、可铸造的 33 个声音键；顺序也是永久事件的规范顺序。 */
export const VALID_SOUND_KEYS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'space', '3', '4', '5', '6', '7', '8',
] as const;

export type SoundKey = (typeof VALID_SOUND_KEYS)[number];

/** 与 VALID_SOUND_KEYS 等价，供 schema、API 和脚本复用。 */
export const SOUND_KEY_PATTERN = /^(?:[a-z]|space|[3-8])$/;
export const CURRENT_SOUND_SET_ID = 'current-33-v1' as const;

const VALID_SOUND_KEY_SET = new Set<string>(VALID_SOUND_KEYS);

export function isSoundKey(value: unknown): value is SoundKey {
  return typeof value === 'string' && VALID_SOUND_KEY_SET.has(value);
}

export function getLocalSoundUrl(key: SoundKey): `/sounds/${SoundKey}.mp3` {
  return `/sounds/${key}.mp3`;
}
