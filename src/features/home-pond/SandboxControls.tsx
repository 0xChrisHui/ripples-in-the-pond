'use client';

import type { GLFlags } from '@/src/components/pond-gl-test3/gl-flags';
import PerfHUD from '@/src/components/PerfHUD';
import LifePanel from '@/src/components/pond-gl-test3/life/LifePanel';
import ScenePanel from '@/src/components/pond-gl-test3/overlay/ScenePanel';
import TunePanel from '@/src/components/pond-gl-test3/overlay/TunePanel';
import P9TuningPanel from '@/src/components/pond-gl-test3/p9/tuning/P9TuningPanel';
import RippleSpikePanel from '@/src/components/pond-gl-test3/water/spike/RippleSpikePanel';

type Props = {
  flags: GLFlags;
  p9: boolean;
  onChange: (patch: Partial<GLFlags>) => void;
};

/** 调参工具独立成异步块，生产首页永远不会下载这组沙盒 UI。 */
export default function SandboxControls({ flags, p9, onChange }: Props) {
  const showWaterTools = flags.rtt || flags.waterFx || flags.floatMotes
    || flags.waterPlants || flags.reefStones || flags.crystalPillars;
  return (
    <>
      <div data-pond-ui="true" className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col-reverse items-end gap-2">
        {p9 && <P9TuningPanel />}
        {flags.glSpheres && <TunePanel />}
        {flags.glSpheres && <LifePanel />}
        {showWaterTools && <RippleSpikePanel />}
      </div>
      <ScenePanel glFlags={flags} onGl={onChange} />
      <PerfHUD />
    </>
  );
}
