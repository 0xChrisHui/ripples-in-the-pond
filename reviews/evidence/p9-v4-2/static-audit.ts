import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { P9_ACTIVE_EFFECTS, P9_EFFECTS, findP9Effect, getP9ParamMeta } from '../../../src/components/pond-gl-test3/p9/registry';
import { P9_FAMILY_META } from '../../../src/components/pond-gl-test3/p9/tuning/p9-tuning-meta';

const fail = (message: string): never => { throw new Error(`[P9 v4.2 audit] ${message}`); };
const expected = new Map<string, string>([
  ['a', 'FX01'], ['b', 'FX02'], ['c', 'FX03'], ['d', 'FX04'], ['e', 'FX05'], ['f', 'FX06'], ['g', 'FX07'],
  ['h', 'FX41'], ['i', 'FX09'], ['j', 'FX10'], ['k', 'FX11'], ['l', 'FX12'], ['m', 'FX13'], ['n', 'FX14'],
  ['o', 'FX15'], ['p', 'FX31'], ['q', 'FX17'], ['r', 'FX18'], ['s', 'FX19'], ['t', 'FX20'], ['u', 'FX21'],
  ['v', 'FX32'], ['w', 'FX23'], ['x', 'FX24'], ['y', 'FX25'], ['z', 'FX39'], ['3', 'FX42'], ['4', 'FX36'],
  ['5', 'FX44'], ['6', 'FX35'], ['7', 'FX30'], ['8', 'FX43'], ['space', 'FX38'],
]);

if (P9_EFFECTS.length !== 33 || P9_ACTIVE_EFFECTS.length !== 33) fail('生产注册表不是 33 项');
if (new Set(P9_EFFECTS.map((effect) => effect.id)).size !== 33) fail('FX ID 存在重复');
if (new Set(P9_EFFECTS.map((effect) => effect.soundKey)).size !== 33) fail('sound key 存在重复');
for (const [key, id] of expected) {
  if (findP9Effect(key)?.id !== id || findP9Effect(key.toUpperCase())?.id !== id) fail(`${key} 映射错误`);
}
const eclipse = P9_EFFECTS.filter((effect) => effect.requiresEclipse);
const water = P9_EFFECTS.filter((effect) => effect.waterWrite);
if (eclipse.length !== 13) fail(`日食依赖数量为 ${eclipse.length}`);
if (water.map((effect) => effect.soundKey).sort().join(',') !== 't,u,v') fail('水面白名单不是 T/U/V');
if (P9_EFFECTS.some((effect) => effect.moonWrite)) fail('出现月光写入效果');

const params = (id: string) => getP9ParamMeta(P9_EFFECTS.find((effect) => effect.id === id)!);
const value = (id: string, key: string) => params(id).find((item) => item.key === key);
if (value('FX02', 'staggerMax')?.initial !== 0.08) fail('B 错峰默认值错误');
if (params('FX43').map((item) => item.key).join(',') !== 'batchLimit') fail('8 仍存在无效参数');
if (P9_FAMILY_META.scene.some((item) => item.key === 'crossfade')) fail('场景 crossfade 仍可见');
if (P9_FAMILY_META.eclipse.some((item) => item.key === 'textureScale')) fail('日食 textureScale 仍可见');
if (value('FX32', 'batchLimit')?.max !== 5 || value('FX44', 'batchLimit')?.max !== 5) fail('V/5 上限不是 5');
if (value('FX25', 'damping')?.initial !== 1.2) fail('Y 阻尼默认值错误');

const soundFiles = readdirSync('public/sounds').filter((name) => name.endsWith('.mp3')).sort();
const hashes = soundFiles.map((name) => createHash('sha256').update(readFileSync(`public/sounds/${name}`)).digest('hex'));
if (soundFiles.length !== 33 || new Set(hashes).size !== 33) fail('音频文件不是 33 个唯一内容');

const retrigger = Object.fromEntries([...new Set(P9_EFFECTS.map((effect) => effect.retrigger))].map((mode) => [
  mode, P9_EFFECTS.filter((effect) => effect.retrigger === mode).map((effect) => effect.soundKey),
]));
const result = {
  generatedAt: new Date().toISOString(), registry: P9_EFFECTS.length, sounds: soundFiles.length,
  requiresEclipse: eclipse.length, independent: 33 - eclipse.length,
  waterKeys: water.map((effect) => effect.soundKey.toUpperCase()), moonWriters: 0, retrigger,
  parameters: { bStagger: value('FX02', 'staggerMax')?.initial, vLimit: value('FX32', 'batchLimit')?.max,
    colonyLimit: value('FX44', 'batchLimit')?.max, yDamping: value('FX25', 'damping')?.initial },
};
writeFileSync('reviews/evidence/p9-v4-2/static-audit.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
