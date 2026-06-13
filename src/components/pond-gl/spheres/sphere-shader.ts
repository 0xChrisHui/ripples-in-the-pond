/**
 * G4 球 shader — instanced 径向渐变球体 + halo falloff。
 *
 * 复刻 SVG 的 C 方案（gradientGlow halo-soft/strong，见 SphereGlowDefs.tsx）：
 * 一个 quad 在片元里按到中心的径向距离画"实色球 + 外圈光晕衰减"，不再用 feGaussianBlur。
 *
 * 每 instance 携带：
 *  - instanceMatrix（three 内置）：translate(x,y,zOrder) * scale(2 * R * HALO_R)，quad 覆盖到 halo 外缘
 *  - aColor (vec3)：球色（播放/hover 高亮时由 CPU 传白）
 *  - aParams (vec4)：x=fillOpacity, y=haloPeak（soft .3 / strong .5）, z=dim（整体不透明度，播放淡出）, w=bodyRatio（body 半径 / quad 半宽 = 1/HALO_R）
 */

/** body 外 halo 半径倍数（对标 SphereNode 的 renderRadius * 1.16） */
export const HALO_R = 1.16;

export const sphereVertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute vec4 aParams;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vParams;
  void main() {
    vUv = uv;
    vColor = aColor;
    vParams = aParams;
    // instanceMatrix 由 three 在 InstancedMesh 下自动注入
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const sphereFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vParams;
  // G4 调色面板（TunePanel）实时写入，1 = 原样
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  void main() {
    float fillOpacity = vParams.x;
    float haloPeak    = vParams.y;
    float dim         = vParams.z;
    float bodyRatio   = vParams.w; // body 边界（归一化到 quad 半宽，≈0.862）

    // 到 quad 中心的归一化距离：0 = 中心，1 = quad 边（= halo 外缘）
    float d = length(vUv - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;

    // body：d < bodyRatio 实色，边缘做一小段抗锯齿（避免硬边）
    float aa = 0.012;
    float bodyMask = 1.0 - smoothstep(bodyRatio - aa, bodyRatio + aa, d);

    // halo：从 body 边缘的 haloPeak 平滑衰减到 quad 边的 0（对标 halo-soft 渐变尾巴）
    float halo = haloPeak * (1.0 - smoothstep(bodyRatio - 0.02, 1.0, d));

    // 合成：body 区取 fillOpacity（球体本体），halo 区取 halo；再乘整体 dim（播放淡出）
    float alpha = mix(halo, max(fillOpacity, haloPeak), bodyMask) * dim;
    if (alpha < 0.003) discard;

    // 调色：亮度 → 对比度（绕 0.5）→ 饱和度（绕亮度）。sRGB 直通，clamp 防溢出
    vec3 col = vColor * uBrightness;
    col = (col - 0.5) * uContrast + 0.5;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = clamp(mix(vec3(lum), col, uSaturation), 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;
