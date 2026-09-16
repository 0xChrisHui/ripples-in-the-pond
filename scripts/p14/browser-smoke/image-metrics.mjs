import assert from 'node:assert/strict';
import sharp from 'sharp';

export async function frameDelta(before, after, excluded, included) {
  const a = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(after).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(a.info, b.info, '涟漪帧尺寸必须一致');
  let delta = 0, total = 0;
  for (let y = 210; y < a.info.height - 170; y += 12) for (let x = 270; x < a.info.width - 60; x += 12) {
    const inFocus = Math.hypot(x - excluded.x, y - excluded.y) < 230;
    const outsideRegion = included
      && Math.hypot(x - included.x, y - included.y) > included.radius;
    if (inFocus || outsideRegion) continue;
    const i = (y * a.info.width + x) * 3;
    delta += Math.abs(a.data[i] - b.data[i])
      + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    total += 3;
  }
  return total ? delta / total : 0;
}

export async function meanBrightness(buffer, excluded) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, total = 0;
  for (let y = 210; y < info.height - 170; y += 18) for (let x = 270; x < info.width - 60; x += 18) {
    if (excluded && Math.hypot(x - excluded.x, y - excluded.y) < 230) continue;
    const i = (y * info.width + x) * 3;
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3; total++;
  }
  return total ? sum / total : 0;
}
