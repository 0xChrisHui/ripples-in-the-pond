import { sinkBehavior } from './behaviors/sink';
import { relayBehavior } from './behaviors/relay';
import { petalsBehavior } from './behaviors/petals';
import { dewBehavior } from './behaviors/dew';
import { liftBehavior } from './behaviors/lift';
import { pressureBehavior, resonanceBehavior, shearBehavior,
  motesBehavior, capillaryBehavior } from './behaviors/water';
import type { KeyFxBehavior, KeyFxFamily } from './key-fx-types';

export const KEY_FX_BEHAVIORS: Readonly<Record<KeyFxFamily, KeyFxBehavior>> = {
  pressure: pressureBehavior,
  resonance: resonanceBehavior,
  shear: shearBehavior,
  motes: motesBehavior,
  capillary: capillaryBehavior,
  sink: sinkBehavior,
  relay: relayBehavior,
  petals: petalsBehavior,
  dew: dewBehavior,
  lift: liftBehavior,
};
