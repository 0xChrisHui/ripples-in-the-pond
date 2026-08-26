/**
 * G4 球 shader — instanced 径向渐变球体 + halo falloff。
 *
 * 复刻 SVG 的 C 方案（gradientGlow halo-soft/strong，见 SphereGlowDefs.tsx）：
 * 一个 quad 在片元里按到中心的径向距离画"实色球 + 外圈光晕衰减"，不再用 feGaussianBlur。
 *
 * 每 instance 携带：
 *  - instanceMatrix（three 内置）：translate(x,y,zOrder) * scale(2 * R * HALO_R)，quad 覆盖到 halo 外缘
 *  - aColor (vec3)：球色（播放/hover 高亮时由 CPU 传白）
 *  - aParams (vec4)：x=fillOpacity, y=haloPeak（soft .3 / strong .5）, z=dim（整体不透明度，播放淡出）,
 *                   w=blurAmt（/test3 task 4 景深失焦度 0..1；bodyRatio 改走常量 uniform uBodyRatio）
 */

/** body 外 halo 半径倍数（对标 SphereNode 的 renderRadius * 1.16） */
export const HALO_R = 1.16;

export const sphereVertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute vec4 aParams;
  attribute vec2 aSeed;
  attribute float aSubmerge;
  attribute float aLifeDim;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vParams;
  varying vec2 vSeed;
  varying float vSubmerge;
  varying float vLifeDim;
  void main() {
    vUv = uv;
    vColor = aColor;
    vParams = aParams;
    vSeed = aSeed;
    vSubmerge = aSubmerge;
    vLifeDim = aLifeDim;
    // instanceMatrix 由 three 在 InstancedMesh 下自动注入
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const sphereFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vParams;
  varying vec2 vSeed; // L3：x=相位种子 φᵢ，y=激励值
  varying float vSubmerge;
  varying float vLifeDim;
  // G4 调色面板（TunePanel）实时写入，1 = 原样
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uColorGrade; // 图 1 风格调色，仅作用于球体及其光晕
  uniform float uBodyRatio; // body 边界（原 aParams.w 常量，腾出 .w 给景深 blurAmt）
  // L3 能量球边缘（uEdgeAmp=0 → 正圆现状；k1/k2 必须整数保 θ 接缝连续）
  uniform float uEdgeAmp;
  uniform float uEdgeK1;
  uniform float uEdgeK2;
  uniform float uEdgeW1;
  uniform float uEdgeW2;
  uniform float uEdgeSoft;
  uniform float uExciteGain;
  uniform float uHaloBreathAmp;
  uniform float uHaloBreathSpeed;
  uniform float uLifeEnv;
  uniform float uTime;
  uniform float uWaterPass; // 0=完整球，1=仅水下，2=仅水上
  void main() {
    float fillOpacity = vParams.x;
    float haloPeak    = vParams.y;
    float playDim     = vParams.z;
    float blurAmt     = vParams.w; // /test3 景深失焦度（0 = 清晰，1 = 完全失焦）
    float bodyRatio   = uBodyRatio;

    // 到 quad 中心的归一化距离：0 = 中心，1 = quad 边（= halo 外缘）
    float d = length(vUv - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;

    // L3 能量球边缘：按极角 θ 双向正弦调制 body 边界（k1/k2 整数保 θ=±π 接缝连续）；激励 vSeed.y 放大幅度。
    // 总幅 clamp≤0.15、调制半径 clamp≤0.98（防波峰顶进 halo 区 / 被 d>1 discard 切平）。uEdgeAmp=0 → body=bodyRatio 现状。
    float th = atan(vUv.y - 0.5, vUv.x - 0.5);
    float w1 = sin(uEdgeK1 * th + vSeed.x + uTime * uEdgeW1);
    float w2 = sin(uEdgeK2 * th - uTime * uEdgeW2 + vSeed.x * 1.7);
    float eamp = min(uEdgeAmp * (1.0 + uExciteGain * vSeed.y), 0.15);
    float body = min(0.98, bodyRatio * (1.0 + eamp * (0.7 * w1 + 0.3 * w2)));

    // body：d < body 实色，边缘抗锯齿 + 边缘虚化 uEdgeSoft；景深失焦 → 轻微加粗边缘 = 软散景（只柔边、不碰颜色）
    float aa = 0.012 + blurAmt * 0.15 + uEdgeSoft;
    float bodyMask = 1.0 - smoothstep(body - aa, body + aa, d);

    // L5 光晕呼吸：速度按 cycles/s 解释；同时改变外圈强度与宽度，单开也能看见，逐球相位避免齐闪。
    float hbPhase = uTime * uHaloBreathSpeed * 6.2831853;
    float hbWave = 0.6 * sin(hbPhase + vSeed.x) + 0.4 * sin(hbPhase * 1.618 + vSeed.x * 2.3);
    float hb = uHaloBreathAmp * uLifeEnv * hbWave;
    float haloStart = clamp(bodyRatio - 0.02 - hb * 0.08, bodyRatio - 0.10, bodyRatio + 0.02);
    float halo = haloPeak * max(0.0, 1.0 + hb * 1.8) * (1.0 - smoothstep(haloStart, 1.0, d));

    // 合成：body 区取 fillOpacity（球体本体），halo 区取 halo；再乘整体 dim（播放淡出）。
    // 景深只柔化边缘(上面 aa)，不动 alpha/颜色 → 失焦不变暗、不褪色（仅"轻轻虚化"）
    float renderSubmerge = smoothstep(0.45, 0.55, vSubmerge);
    float waterWeight = 1.0;
    if (uWaterPass > 1.5) waterWeight = 1.0 - renderSubmerge;
    else if (uWaterPass > 0.5) waterWeight = renderSubmerge;
    float alpha = mix(halo, max(fillOpacity, haloPeak), bodyMask) * playDim * vLifeDim * waterWeight;
    if (uWaterPass > 1.5) alpha = max(alpha, bodyMask * playDim * waterWeight);
    if (alpha < 0.003) discard;

    // 调色：亮度 → 对比度（绕 0.5）→ 饱和度（绕亮度）。sRGB 直通，clamp 防溢出
    vec3 col = vColor * uBrightness;
    col = (col - 0.5) * uContrast + 0.5;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = clamp(mix(vec3(lum), col, uSaturation), 0.0, 1.0);
    if (uColorGrade > 0.5) {
      col *= 0.88;
      col = (col - 0.5) * 1.1 + 0.5;
      col = mix(col, vec3(
        dot(col, vec3(0.393, 0.769, 0.189)),
        dot(col, vec3(0.349, 0.686, 0.168)),
        dot(col, vec3(0.272, 0.534, 0.131))
      ), 0.08);
      col = clamp(col, 0.0, 1.0);
    }
    float haloOnly = (1.0 - bodyMask) * clamp(halo, 0.0, 1.0);
    float coldLift = clamp(max(0.0, hb) * haloOnly * 0.65, 0.0, 0.22);
    col = mix(col, vec3(0.78, 0.90, 1.0), coldLift); // 呼气峰值微微泛冷白，暗塘上更易辨认

    // 景深不再改颜色：原"失焦变暗 + 去饱和"已移除（用户反馈对颜色影响太大）→ 失焦只柔边
    gl_FragColor = vec4(col, alpha);
  }
`;
