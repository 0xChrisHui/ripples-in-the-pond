'use client';

import type { EffectsConfig } from '../../effects-config';
import AuroraBackground from './aurora-background';
import StarsBackground from './stars-background';
import FogLayer from './fog-layer';
// Lane B 环境线（P8-B S4/S5/S7 + F1/F3/F4）
import CausticsLayer from './pond/caustics-layer';
import FilmGrain from './pond/film-grain';
import PondLights from './pond/pond-lights';
import DropsLayer from './pond/drops-layer';
import PondShadow from './pond/pond-shadow';
import SkyReflection from './pond/sky-reflection';
import MoonPath from './pond/moon-path';
import PondEdge from './pond/pond-edge';
import AudioNarrative from '../motion/audio-narrative';

/**
 * 全部氛围层 + 音频协调层的集中挂载点（从 Archipelago 抽出，控其行数）。
 * 旧氛围（aurora/stars/fog）+ Lane B 水塘氛围 8 件 + Lane D 音频协调。
 * 关任一 flag = 该层不挂 = 回现状；全关 = 与开工前像素级一致。
 */
export default function AmbientLayers({ effects }: { effects: EffectsConfig }) {
  return (
    <>
      {effects.aurora && <AuroraBackground />}
      {effects.stars && <StarsBackground />}
      {effects.fog && <FogLayer />}
      {effects.caustics && <CausticsLayer />}
      {effects.pondShadow && <PondShadow />}
      {effects.skyReflection && <SkyReflection />}
      {effects.pondLights && <PondLights />}
      {effects.moonPath && <MoonPath />}
      {effects.pondEdge && <PondEdge />}
      {effects.filmGrain && <FilmGrain />}
      {/* rain=1 覆盖 drops 节奏（同组件强化档），rain 关时退回 drops 档 */}
      {(effects.drops || effects.rain) && <DropsLayer rain={effects.rain} />}
      {/* Lane D 音频线协调（自挂 fixed overlay，beatRipple/echoRipple/playWaves/bubbles/lightFollow + 音频能量）*/}
      <AudioNarrative effects={effects} />
    </>
  );
}
