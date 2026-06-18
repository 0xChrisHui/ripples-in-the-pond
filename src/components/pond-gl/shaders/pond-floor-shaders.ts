/**
 * K10 塘底花纹库（5 套，由 uPondFloorStyle 选）。
 *
 * 这段 GLSL 注入进 water-distort-shaders.ts 的 compositeMaskFrag（同一着色器内）→ 可直接读 uViewport。
 * pondFloorColor 返回 vec3「冷暗色×强弱」；main 再 ×uPondFloorStrength×sub 叠加（只加亮不压暗 → 不破"水下不压黑"）。
 * 静止（不随 uTime/缩放）→ 动水面在其上折射产生视差 = K10 纵深核心。
 * 5 套：0 细沙(偏亮) / 1 彩晕(偏彩) / 2 鹅卵石 / 3 沙纹 / 4 矿脉微光。比旧值噪声更"有结构"、不脏。
 * GLSL ES 1.00：循环常量边界、无 % 运算（用 k/3、k-(k/3)*3 代）。
 */
export const pondFloorGlsl = /* glsl */ `
  float pfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float pfNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(pfHash(i), pfHash(i + vec2(1.0, 0.0)), f.x),
               mix(pfHash(i + vec2(0.0, 1.0)), pfHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // voronoi：到最近特征点距离（鹅卵石用）。9 邻格展平成单循环，避 ES1.00 嵌套循环 + % 限制。
  float pfVoro(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float md = 1.0;
    for (int k = 0; k < 9; k++) {
      vec2 g = vec2(float(k / 3 - 1), float(k - (k / 3) * 3 - 1));
      vec2 o = vec2(pfHash(i + g), pfHash(i + g + vec2(7.3, 1.7)));
      md = min(md, length(g + o - f));
    }
    return md;
  }

  vec3 pondFloorColor(vec2 uv, float style) {
    vec2 p = uv * vec2(uViewport.x / max(1.0, uViewport.y), 1.0); // 宽高比校正 → 纹理不被宽屏拉长
    if (style < 0.5) {
      // 0 细沙·偏亮：双 octave 平滑沙、冷白偏亮、起伏柔和（最亮的一套）。
      float n = pfNoise(p * 7.0) * 0.6 + pfNoise(p * 18.0) * 0.4;
      return smoothstep(0.25, 0.95, n) * vec3(0.55, 0.68, 0.78) * 1.5;
    } else if (style < 1.5) {
      // 1 彩晕·偏彩：低频冷色谱漂移（青→蓝→紫），淡雅不艳（唯一上色的一套）。
      float n = pfNoise(p * 4.0);
      float hue = pfNoise(p * 2.5 + 3.0);
      vec3 col = mix(mix(vec3(0.16, 0.46, 0.42), vec3(0.24, 0.30, 0.62), hue), vec3(0.44, 0.26, 0.52), smoothstep(0.4, 0.8, n));
      return col * smoothstep(0.2, 0.9, n) * 1.0;
    } else if (style < 2.5) {
      // 2 鹅卵石：voronoi 圆石，石心亮、缝隙暗，冷灰。
      float d = pfVoro(p * 6.0);
      return smoothstep(0.55, 0.05, d) * vec3(0.34, 0.42, 0.48);
    } else if (style < 3.5) {
      // 3 沙纹：平行波状沙脊（sin + 噪声 warp）→ 水下沙丘。
      float warp = pfNoise(p * 3.0) * 1.2;
      float ridges = 0.5 + 0.5 * sin(p.y * 26.0 + warp * 4.0 + p.x * 2.0);
      return pow(ridges, 2.0) * vec3(0.40, 0.50, 0.56);
    }
    // 4 矿脉微光：大片暗 + 稀疏亮脉/矿点（高阈噪声），极简优雅。
    float vein = smoothstep(0.78, 0.96, pfNoise(p * 5.0));
    float spec = smoothstep(0.90, 1.0, pfHash(floor(p * 42.0)));
    return vein * vec3(0.30, 0.50, 0.60) + spec * vec3(0.6, 0.75, 0.9);
  }
`;
