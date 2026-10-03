import type { ResidentEchoConfig, ResidentEchoFrameInput, ResidentEchoPose, ResidentMotionState, ResidentPresenceState } from '../../../../types/echo-resident';
import { project, unproject } from '../../sphere-projection';
import { motionPoint, sampleScalar } from '../motion';
import { normalizeResidentLayout } from './layout';

export function resolveResidentPose(instanceId: string, frameId: number, motion: ResidentMotionState, time: number,
  presence: ResidentPresenceState, input: ResidentEchoFrameInput, config: ResidentEchoConfig): ResidentEchoPose {
  const p = motionPoint(motion, time);
  const depth = Math.max(0.02, Math.min(0.98, motion.surface + sampleScalar(motion.depth, time)));
  const breathScale = sampleScalar(motion.scale, time);
  const projectionScale = project(0, 0, depth, input.layout.projection).scale;
  const bodyRadiusPx = Math.max(0, input.layout.baseRadiusPx) * config.diameterMultiplier
    * breathScale * projectionScale * motion.bounds.sizeScale;
  const usable = input.available && input.healthy && input.sceneReady;
  const scenePresence = Number.isFinite(input.scenePresence) ? Math.max(0, Math.min(1, input.scenePresence)) : 0;
  const effectivePresence = usable ? presence.presence * scenePresence : 0;
  const interactive = effectivePresence >= config.hitThreshold && bodyRadiusPx > 0;
  return { instanceId, frameId, sx: p.x, sy: p.y, depth, breathScale, bodyRadiusPx,
    haloRadiusPx: bodyRadiusPx * input.layout.haloRatio, presence: presence.presence, effectivePresence,
    interactive, tabbable: interactive && presence.phase !== 'fading_out',
    sizeClamped: motion.bounds.sizeClamped, sizeScale: motion.bounds.sizeScale,
    resizeConstrained: motion.resizeConstrained };
}
/** 共享水面只能消费这一帧的 pose，不再经过普通球 applyFloat / 深度漂移。 */
export function resolveResidentScenePose(pose: ResidentEchoPose, input: ResidentEchoFrameInput) {
  input = { ...input, layout: normalizeResidentLayout(input.layout) };
  const sim = unproject(pose.sx, pose.sy, pose.depth, input.layout.projection);
  const projected = project(sim.x, sim.y, pose.depth, input.layout.projection);
  return { ...pose, simX: sim.x, simY: sim.y, blurAmt: projected.blurAmt,
    submerge: (() => {
      const t = Math.max(0, Math.min(1, (input.layout.surface - pose.depth + 0.02) / 0.12));
      return t * t * (3 - 2 * t);
    })(), shaderAlpha: pose.effectivePresence, waterMaskPresence: pose.effectivePresence };
}
