import type { ResidentEchoFrameInput, ResidentEchoOptions, ResidentEchoRuntime, ResidentEchoSnapshot } from '../../../types/echo-resident';
import { RESIDENT_ECHO_DEFAULTS, validateResidentConfig } from './config';
import { createResidentRandom, createVisualSeed } from './random';
import { createMotionState, moveMotion, resizeMotion, resumeMotion, stepMotion } from './motion';
import { createPresenceState, stepPresence } from './presence';
import { resolveResidentPose } from './render/pose';
import { createLocks, stepLocks } from './state/locks';
import { normalizeResidentLayout } from './render/layout';
import { advanceCircleHover } from '../eclipse-base/eclipse-motion';

/** 仅保存视觉与手势命令状态，不拥有 AudioContext、Track、定时器或链写入。 */
export function createResidentEchoRuntime(options: ResidentEchoOptions): ResidentEchoRuntime {
  options = { ...options, layout: normalizeResidentLayout(options.layout) };
  const validated = validateResidentConfig(options.config ?? RESIDENT_ECHO_DEFAULTS);
  if (!validated.valid) options.onConfigError?.(validated.reasons);
  const config = validated.config, seed = options.seed ?? createVisualSeed();
  const random = createResidentRandom(seed);
  let motion = createMotionState(options.layout, config, random);
  let awaitingInitialLayout = motion.bounds.sizeClamped;
  const presence = createPresenceState(config, random.presence), locks = createLocks();
  const clock = options.clock ?? (() => performance.now());
  const listeners = new Set<() => void>();
  const instanceId = `resident-echo-${seed >>> 0}`;
  let destroyed = false, documentHidden = false, lastNow: number | null = null;
  let motionSeconds = 0, presenceSeconds = 0, frameId = 0, hoverProgress = 0;
  let commandPending = false, commandError: string | null = null;
  let reducedMotionOverride: boolean | null = null;
  const initial: ResidentEchoFrameInput = { layout: options.layout, available: false, healthy: false,
    sceneReady: false, scenePresence: 0, sceneRestored: false, reducedMotion: false,
    playback: 'idle', otherPlaybackActive: false };
  let latestInput = initial, dragging = false;
  const calls = () => ({ drift: random.drift.calls, depth: random.depth.calls,
    scale: random.scale.calls, presence: random.presence.calls });
  let snapshot: ResidentEchoSnapshot = { pose: resolveResidentPose(instanceId, 0, motion, 0, presence, initial, config),
    phase: presence.phase, interaction: { ...locks.interaction }, motionSeconds, presenceSeconds, playbackHeld: false,
    commandPending, commandError, destroyed, randomCalls: calls() };
  const publish = () => { for (const listener of listeners) listener(); };
  const runtime: ResidentEchoRuntime = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (destroyed) return () => undefined;
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    step(input, nowMs = clock()) {
      if (destroyed) return snapshot;
      input = { ...input, layout: normalizeResidentLayout(input.layout) };
      if (reducedMotionOverride !== null) input = { ...input, reducedMotion: reducedMotionOverride };
      latestInput = input;
      const now = Number.isFinite(nowMs) ? nowMs : lastNow ?? 0;
      const elapsed = lastNow === null || documentHidden ? 0 : Math.max(0, (now - lastNow) / 1000);
      // 低帧率按真实时间分段推进；长卡顿视为挂起，不在恢复帧追赶整段路线。
      const elapsedVisible = elapsed <= 0.5 ? elapsed : 0;
      const steps = Math.max(1, Math.ceil(elapsedVisible / config.maxDeltaSeconds));
      const delta = elapsedVisible / steps;
      hoverProgress = advanceCircleHover(hoverProgress, locks.interaction.hovered, elapsedVisible * 1000, input.reducedMotion);
      lastNow = now;
      resizeMotion(motion, input.layout, config, motionSeconds);
      // 1×1首帧没有可用路线；首次获得完整区域才初始化，普通resize仍不重抽。
      if (awaitingInitialLayout && !motion.bounds.sizeClamped) {
        motion = createMotionState(input.layout, config, random);
        awaitingInitialLayout = false;
      }
      let playbackHeld = snapshot.playbackHeld;
      for (let i = 0; i < steps; i++) {
        const locked = stepLocks(locks, input, commandPending, delta, config, random.presence);
        playbackHeld = locked.playbackHeld;
        const motionDelta = documentHidden || motion.bounds.sizeClamped ? 0 : locked.deltaMotion;
        motionSeconds += motionDelta;
        stepMotion(motion, motionSeconds, motionDelta, input.layout.surface, config, random);
        const presenceDelta = documentHidden || locked.scenePaused ? 0 : delta;
        if (!locked.presenceHeld && !input.reducedMotion) presenceSeconds += presenceDelta;
        if (!documentHidden && !locked.scenePaused) stepPresence(presence, presenceDelta,
          locked.presenceHeld, input.reducedMotion, config, random.presence);
      }
      const pose = resolveResidentPose(instanceId, ++frameId, motion, motionSeconds, presence, input, config, hoverProgress);
      snapshot = { pose, phase: presence.phase, interaction: { ...locks.interaction }, motionSeconds, presenceSeconds,
        playbackHeld, commandPending, commandError, destroyed, randomCalls: calls() };
      publish(); return snapshot;
    },
    setInteraction(update) {
      if (destroyed) return;
      Object.assign(locks.interaction, update);
      snapshot = { ...snapshot, interaction: { ...locks.interaction } };
      publish();
    },
    moveDrag(point) {
      if (destroyed || commandPending || snapshot.playbackHeld || !snapshot.pose.interactive
        || !locks.interaction.pointerDown || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      dragging = true;
      moveMotion(motion, point, motionSeconds);
      snapshot = { ...snapshot, pose: resolveResidentPose(instanceId, ++frameId, motion,
        motionSeconds, presence, latestInput, config, hoverProgress) };
      publish();
    },
    endDrag() {
      if (destroyed || !dragging) return;
      dragging = false;
      resumeMotion(motion, motionSeconds, config, random);
    },
    setVisibility(hidden) {
      if (destroyed || documentHidden === hidden) return;
      documentHidden = hidden; lastNow = null;
    },
    setReducedMotion(reduced) {
      if (!destroyed) reducedMotionOverride = reduced;
    },
    async request(command, execute) {
      if (destroyed || commandPending || locks.interaction.pointerDown) return;
      commandPending = true; commandError = null;
      snapshot = { ...snapshot, commandPending, commandError,
        playbackHeld: command === 'play' || command === 'resume' || command === 'retry' || snapshot.playbackHeld };
      publish();
      try {
        await execute(command);
      } catch (error: unknown) {
        if (!destroyed) commandError = error instanceof Error ? error.message : 'ECHO 播放失败，请重试';
      } finally {
        if (!destroyed) {
          commandPending = false;
          snapshot = { ...snapshot, commandPending, commandError,
            playbackHeld: commandError ? false : snapshot.playbackHeld };
          publish();
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; commandPending = false;
      snapshot = { ...snapshot, destroyed, commandPending,
        pose: { ...snapshot.pose, effectivePresence: 0, interactive: false, tabbable: false } };
      publish(); listeners.clear(); lastNow = null;
    },
  };
  return runtime;
}
