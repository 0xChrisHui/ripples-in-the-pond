/**
 * K10 塘底花纹库（5 套极差异化，由 uPondFloorStyle 选）。
 *
 * 注入进 water-distort-shaders.ts 的合成着色器（同一着色器内）→ 可直接读 uViewport。
 * pondFloorColor(uv, style) 返回 vec3「冷暗/彩色光×强弱」；main 再 ×uPondFloorStrength×sub 叠加
 * （只加亮不压暗 → 不破"水下不压黑"）。静止（不随 uTime/缩放）→ 动水面在其上折射产生视差 = K10 纵深核心。
 * 5 套：0 暗矿(矿脉晶簇) / 1 亮沙(暖白细沙+焦散池) / 2 虹彩(油膜珠光) / 3 莲花(曼陀罗) / 4 星河(星云星点)。
 * GLSL ES 1.00：循环常量边界、无 %（用 k/3、k-(k/3)*3）、helper 各带 f<idx>_ 前缀防重名、无 uTime。
 */
export const pondFloorGlsl = /* glsl */ `
  // ===== floorStyle0「暗矿 Dark Ore Vein」=====
  float f0_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float f0_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(f0_hash(i), f0_hash(i + vec2(1.0, 0.0)), f.x),
               mix(f0_hash(i + vec2(0.0, 1.0)), f0_hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float f0_fbm(vec2 p) {
    float val = 0.0, amp = 1.0, freq = 1.0;
    for (int k = 0; k < 4; k++) { val += f0_noise(p * freq) * amp; amp *= 0.5; freq *= 2.1; }
    return val;
  }
  float f0_voro(vec2 p) {
    vec2 i = floor(p), f = fract(p); float md = 1.0;
    for (int k = 0; k < 9; k++) {
      vec2 g = vec2(float(k / 3 - 1), float(k - (k / 3) * 3 - 1));
      vec2 o = vec2(f0_hash(i + g), f0_hash(i + g + vec2(7.3, 1.7)));
      md = min(md, length(g + o - f));
    }
    return md;
  }
  float f0_vein(vec2 p) { return smoothstep(0.68, 0.82, f0_fbm(p * 3.0)); }
  vec3 floorStyle0(vec2 p) {
    float deepBase = f0_fbm(p * 1.5) * 0.08 + 0.02;       // 超低频暗底（近纯黑）
    float vein = f0_vein(p * 7.0);
    vein = vein * smoothstep(0.0, 0.03, vein);            // 冷蓝白细矿脉、细线化
    float isCrystal = smoothstep(0.92, 1.0, f0_hash(floor(p * 42.0))); // 约 8% 晶格点产矿
    float clusterMask = smoothstep(0.15, 0.0, f0_voro(p * 18.0)) * isCrystal;
    vec3 col = deepBase * vec3(0.05, 0.06, 0.08);         // 暗底纯黑质感、仅微冷
    col += vein * vec3(0.20, 0.38, 0.48) * 0.15;          // 矿脉（青灰、整体很低）
    col += clusterMask * vec3(0.28, 0.48, 0.58) * 0.25;   // 矿点（幽蓝、极稀疏）
    float microNoise = smoothstep(0.45, 0.55, f0_noise(p * 95.0)); // 超高频微网纹（增结构）
    col += microNoise * vec3(0.08, 0.12, 0.15) * 0.08;
    return col;
  }

  // ===== floorStyle1「亮沙 Bright Sand」=====
  float f1_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float f1_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(f1_hash(i), f1_hash(i + vec2(1.0, 0.0)), f.x),
               mix(f1_hash(i + vec2(0.0, 1.0)), f1_hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float f1_voronoi(vec2 p) {
    vec2 i = floor(p), f = fract(p); float md = 1.0;
    for (int k = 0; k < 9; k++) {
      vec2 g = vec2(float(k / 3 - 1), float(k - (k / 3) * 3 - 1));
      vec2 o = vec2(f1_hash(i + g), f1_hash(i + g + vec2(7.3, 1.7)));
      md = min(md, length(g + o - f));
    }
    return md;
  }
  vec3 floorStyle1(vec2 p) {
    // p 已是宽高比校正 UV（dispatcher 传入），不再二次校正。
    float sand = f1_noise(p * 18.0) * 0.4 + f1_noise(p * 7.0) * 0.6; // 双 octave 细沙
    sand = sand * 0.8 + 0.2;                                          // 归一 [0.2,1] 保底
    float caustic = smoothstep(0.35, 0.02, f1_voronoi(p * 6.0));      // 大块焦散光池
    float detail = sand * 0.7, pool = caustic * (0.8 + sand * 0.4);
    vec3 result = vec3(0.62, 0.68, 0.78) * detail + vec3(1.0, 0.95, 0.75) * pool; // 冷白底+暖黄高光
    result = clamp(result, vec3(0.3), vec3(1.6));                     // 压实高光、避超饱和
    return result * 1.1;
  }

  // ===== floorStyle2「虹彩 Iridescent Rainbow」=====
  float f2_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float f2_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(f2_hash(i), f2_hash(i + vec2(1.0, 0.0)), f.x),
               mix(f2_hash(i + vec2(0.0, 1.0)), f2_hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 f2_hsv2rgb(vec3 hsv) {
    vec3 c = vec3(0.5 + 0.5 * cos(6.28318 * (hsv.x + 0.0 / 3.0)),
                  0.5 + 0.5 * cos(6.28318 * (hsv.x + 1.0 / 3.0)),
                  0.5 + 0.5 * cos(6.28318 * (hsv.x + 2.0 / 3.0)));
    return mix(vec3(1.0), c, hsv.y) * hsv.z;
  }
  float f2_voronoi(vec2 p) {
    vec2 i = floor(p), f = fract(p); float md = 1.0;
    for (int k = 0; k < 9; k++) {
      vec2 g = vec2(float(k / 3 - 1), float(k - (k / 3) * 3 - 1));
      vec2 o = vec2(f2_hash(i + g), f2_hash(i + g + vec2(7.3, 1.7)));
      md = min(md, length(g + o - f));
    }
    return md;
  }
  float f2_spiral(vec2 p) { return sin(atan(p.y, p.x) * 6.0 + length(p) * 8.0) * 0.5 + 0.5; }
  vec3 floorStyle2(vec2 p) {
    float spiral1 = f2_spiral(p * 3.5 - 1.5);                 // 多层虹彩漩涡（错相→流动）
    float spiral2 = f2_spiral((p - vec2(0.3, 0.5)) * 4.2 - 2.0);
    float voro = smoothstep(0.35, 0.05, f2_voronoi(p * 5.5));
    float thick = mix(f2_noise(p * 2.8) * 0.4 + f2_noise(p * 1.3 + 11.3) * 0.6, voro * 0.8, 0.5); // 油膜厚薄
    float hue = fract(spiral1 * 0.35 + spiral2 * 0.45 + f2_noise(p * 1.9 + 5.1) * 0.2);
    vec3 iridescent = f2_hsv2rgb(vec3(hue, 0.85 + 0.15 * sin(thick * 3.14159), 0.6 + 0.4 * thick)); // 全光谱珠光
    float edge = 1.0 - smoothstep(0.0, 0.15, f2_voronoi(p * 5.5)); // 珍珠母贝边缘高光
    vec3 shimmer = iridescent + edge * vec3(0.35, 0.35, 0.3) * 0.8;
    return shimmer * (0.5 + thick * 0.7);                     // 偏亮、油膜柔和
  }

  // ===== floorStyle3「莲花 Lotus Mandala」=====
  float f3_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float f3_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(f3_hash(i), f3_hash(i + vec2(1.0, 0.0)), f.x),
               mix(f3_hash(i + vec2(0.0, 1.0)), f3_hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 floorStyle3(vec2 p) {
    vec2 c = p - 0.5; float r = length(c), angle = atan(c.y, c.x), petals = 8.0; // 8 叶 N 重对称
    float petalPattern = cos(angle * petals);
    float petal1 = smoothstep(0.45, 0.2, r) * (0.4 + 0.6 * smoothstep(-0.3, 0.6, petalPattern));
    vec3 col1 = mix(vec3(0.15, 0.05, 0.1), vec3(0.95, 0.7, 0.78), petal1) * 0.7; // 外层粉
    float petal2 = smoothstep(0.2, 0.08, r) * (0.3 + 0.7 * smoothstep(-0.2, 0.8, cos(angle * petals + 0.785)));
    vec3 col2 = mix(vec3(0.18, 0.38, 0.48), vec3(0.78, 0.82, 0.6), petal2) * 0.85; // 中层青金
    float petal3 = smoothstep(0.08, 0.01, r) * (0.5 + 0.5 * smoothstep(-0.5, 0.5, petalPattern));
    vec3 col3 = vec3(0.8, 0.85, 0.92) * petal3 * 1.1;        // 内层冷白金光
    float heart = smoothstep(0.02, 0.0, r);
    vec3 colHeart = mix(vec3(1.0, 0.95, 0.8), vec3(1.0), heart) * heart * 1.3; // 花心金白
    vec3 result = col1 + col2 + col3 + colHeart;             // 内层覆盖外层
    float soft = f3_noise(p * 2.5) * 0.15;                   // 低频噪声微扰（朦胧）
    result += vec3(soft * 0.05, soft * 0.02, soft * 0.08);
    return result * smoothstep(1.1, 0.4, r);                 // 四周柔窗淡出
  }

  // ===== floorStyle4「星河 Star River」=====
  float f4_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float f4_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(f4_hash(i), f4_hash(i + vec2(1.0, 0.0)), f.x),
               mix(f4_hash(i + vec2(0.0, 1.0)), f4_hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float f4_fbm(vec2 p) {
    return f4_noise(p * 1.0) * 0.5 + f4_noise(p * 2.3) * 0.25 + f4_noise(p * 4.7) * 0.125;
  }
  vec3 f4_nebulaColor(vec2 p) {
    float rChan = f4_fbm(p * 0.8), gChan = f4_fbm(p * 0.9 + vec2(3.3, 1.5)), bChan = f4_fbm(p * 0.7 + vec2(1.1, 3.7));
    vec3 col1 = mix(vec3(0.24, 0.0, 0.40), vec3(0.0, 0.20, 0.80), rChan); // 紫→蓝
    vec3 col2 = mix(col1, vec3(1.0, 0.08, 0.58), gChan * 0.5);            // 加粉
    return mix(col2, vec3(0.50, 0.0, 0.60), bChan * 0.3);                 // 加深紫
  }
  float f4_starPoint(vec2 gridPos, float threshold) {
    float rnd = f4_hash(gridPos);
    if (rnd > threshold) return 0.0;
    return (rnd - threshold) / (1.0 - threshold);
  }
  float f4_starNeighborMax(vec2 p, float threshold) {
    vec2 grid = floor(p); float maxStar = 0.0;
    for (int k = 0; k < 9; k++) {
      vec2 offset = vec2(float(k / 3 - 1), float(k - (k / 3) * 3 - 1));
      maxStar = max(maxStar, f4_starPoint(grid + offset, threshold));
    }
    return maxStar;
  }
  vec3 floorStyle4(vec2 p) {
    float nebulaWarp = f4_fbm(p * 2.5) * 0.3 - 0.15;                          // 对角星云带扭动 ±0.15
    float nebulaMask = exp(-pow(((p.x - p.y) * 0.8 + nebulaWarp) * 3.0, 2.0)); // 高斯柔光
    vec3 result = vec3(0.08, 0.08, 0.12) + f4_nebulaColor(p * 1.2) * nebulaMask * 0.8; // 深空背景+彩色星云
    vec2 pdense = p * 12.0, psparse = p * 6.0;
    float starsDense = f4_starNeighborMax(pdense, 0.92) * (0.4 + 0.2 * f4_noise(pdense)); // 密星
    float sparGrid = f4_starNeighborMax(psparse, 0.96);
    float starsSparse = sparGrid * sparGrid * (0.7 + 0.3 * f4_noise(psparse * 0.5));      // 疏星（平方强化）
    float starGlow = 0.0;                                                     // 星点光晕
    for (int i = 0; i < 4; i++) {
      vec2 dir = vec2(cos(float(i) * 1.5707963), sin(float(i) * 1.5707963)) * 0.08;
      starGlow += (f4_starNeighborMax(pdense + dir, 0.92) * 0.15 + f4_starNeighborMax(psparse + dir, 0.96) * 0.25)
                  * (1.0 - length(dir) / 0.08);
    }
    starGlow *= 0.25;
    float starsTotal = starsDense * 0.5 + starsSparse * 1.0 + starGlow * 0.6;
    result += vec3(1.0, 0.98, 0.95) * starsTotal;            // 星点略暖白
    return clamp(result * 0.8, 0.0, 1.0);                    // 整体压暗（塘底、不挡球）
  }

  // ===== dispatcher：宽高比校正后按 uPondFloorStyle 选一套（接口同旧，main 不改）=====
  vec3 pondFloorColor(vec2 uv, float style) {
    vec2 p = uv * vec2(uViewport.x / max(1.0, uViewport.y), 1.0); // 纹理不被宽屏拉长
    if (style < 0.5) return floorStyle0(p);
    else if (style < 1.5) return floorStyle1(p);
    else if (style < 2.5) return floorStyle2(p);
    else if (style < 3.5) return floorStyle3(p);
    return floorStyle4(p);
  }
`;
