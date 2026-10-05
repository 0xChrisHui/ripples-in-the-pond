export type CircleMotion = {
  x: number; y: number; vx: number; vy: number;
  targetX: number; targetY: number; remaining: number; seed: number;
};

/** 随机会话种子只用于运动；可复现同一路径，既不由曲号决定也不按时间重复。 */
function random(motion: CircleMotion) {
  let value = motion.seed = (motion.seed + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function chooseTarget(motion: CircleMotion) {
  const angle = random(motion) * Math.PI * 2;
  const distance = .8 + random(motion) * 1.1;
  motion.targetX = Math.cos(angle) * distance;
  motion.targetY = Math.sin(angle) * distance;
  motion.remaining = 3.5 + random(motion) * 4;
}

export function createCircleMotion(seed: number): CircleMotion {
  const motion = { x: 0, y: 0, vx: 0, vy: 0, targetX: 0, targetY: 0, remaining: 0, seed };
  const angle = random(motion) * Math.PI * 2;
  const speed = .22 + random(motion) * .16;
  motion.vx = Math.cos(angle) * speed; motion.vy = Math.sin(angle) * speed;
  chooseTarget(motion);
  return motion;
}

/** 临界阻尼的解析步进保留速度，帧率变化和随机换目标不会跳位置。 */
export function advanceCircleSpring(position: number, velocity: number, target: number, seconds: number, frequency = .9) {
  const error = position - target; const decay = Math.exp(-frequency * seconds);
  const momentum = velocity + frequency * error;
  return { position: target + (error + momentum * seconds) * decay,
    velocity: (velocity - frequency * momentum * seconds) * decay };
}

export function stepCircleMotion(motion: CircleMotion, seconds: number) {
  let elapsed = Math.max(0, seconds);
  while (elapsed > 0) {
    const step = Math.min(elapsed, motion.remaining);
    const x = advanceCircleSpring(motion.x, motion.vx, motion.targetX, step);
    const y = advanceCircleSpring(motion.y, motion.vy, motion.targetY, step);
    motion.x = x.position; motion.vx = x.velocity; motion.y = y.position; motion.vy = y.velocity;
    elapsed -= step; motion.remaining -= step;
    if (motion.remaining < 1e-9) chooseTarget(motion);
  }
}
