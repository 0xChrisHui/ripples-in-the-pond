'use client';
import type { RefObject } from 'react';
import type { GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import { DEFAULT_GL_FLAGS, pickLifeFlags } from '@/src/components/pond-gl-test3/gl-flags';
import SphereInstances from '@/src/components/pond-gl-test3/spheres/SphereInstances';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import type { PondSceneDescriptor } from '@/src/components/pond-shell/scene-slot';

export const ARCHIVE_FLAGS: GLFlags = { ...DEFAULT_GL_FLAGS,
  glSpheres: true, sphereLabels: false, sphereMotion: false, sphereDrift: false,
  glEclipse: false, floatMotes: false, waterPlants: false, reefStones: false, crystalPillars: false };

/** Score接管其模型时，旧首页仍能在同一Canvas中完成退场。 */
export default function PondSceneLayers({ home, flags, presence, reduced, score, tracks }: {
  home: GlSim; flags: GLFlags; presence: RefObject<number>; reduced: boolean;
  score?: PondSceneDescriptor; tracks?: PondSceneDescriptor;
}) {
  return <>
    {score && flags.glSpheres && <SphereInstances glSim={home} waterOn={flags.water}
      motionOn={flags.sphereMotion} sphereDrift={flags.sphereDrift} separatePass={flags.waterFx}
      colorGrade={flags.colorGrade} life={pickLifeFlags(flags)} scenePresence={presence} reducedSceneMotion={reduced} />}
    {score?.sceneContent}{tracks?.sceneContent}
  </>;
}
