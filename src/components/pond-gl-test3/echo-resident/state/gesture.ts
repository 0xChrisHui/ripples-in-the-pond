import type { ResidentEchoCommand, ResidentEchoPlayback, ResidentEchoRuntime, ResidentPoint } from '../../../../types/echo-resident';

const DRAG_THRESHOLD = 8;

/** 沿用普通圆8px阈值；拖动、取消和失去捕获都不能落入播放分支。 */
export function createResidentGesture(runtime: ResidentEchoRuntime, getPlayback: () => ResidentEchoPlayback,
  execute: (command: ResidentEchoCommand) => void | Promise<void>) {
  let pointerId: number | null = null, moved = false;
  let start: ResidentPoint = { x: 0, y: 0 }, origin = start;
  const activate = () => {
    if (pointerId !== null || !runtime.getSnapshot().pose.interactive) return;
    const state = getPlayback();
    const command = state === 'playing' ? 'pause' : state === 'paused' ? 'resume'
      : state === 'error' || runtime.getSnapshot().commandError ? 'retry' : 'play';
    void runtime.request(command, execute);
  };
  const end = (id: number, canceled = false) => {
    if (pointerId !== id) return false;
    const shouldActivate = !canceled && !moved;
    pointerId = null; moved = false;
    runtime.endDrag(); runtime.setInteraction({ pointerDown: false });
    if (shouldActivate) activate();
    return shouldActivate;
  };
  return {
    activate,
    begin(id: number, point: ResidentPoint) {
      const snapshot = runtime.getSnapshot();
      if (pointerId !== null || !snapshot.pose.interactive || snapshot.commandPending) return false;
      pointerId = id; start = point; moved = false;
      origin = { x: snapshot.pose.sx, y: snapshot.pose.sy };
      runtime.setInteraction({ pointerDown: true });
      return true;
    },
    move(id: number, point: ResidentPoint) {
      if (pointerId !== id) return;
      const dx = point.x - start.x, dy = point.y - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      runtime.moveDrag({ x: origin.x + dx, y: origin.y + dy });
    },
    end,
    cancel() { if (pointerId !== null) end(pointerId, true); },
  };
}
