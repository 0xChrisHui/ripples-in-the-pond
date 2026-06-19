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
  uniform float uBodyRatio; // body 边界（原 aParams.w 常量，腾出 .w 给景深 blurAmt）
  void main() {
    float fillOpacity = vParams.x;
    float haloPeak    = vParams.y;
    float dim         = vParams.z;
    float blurAmt     = vParams.w; // /test3 景深失焦度（0 = 清晰，1 = 完全失焦）
    float bodyRatio   = uBodyRatio;

    // 到 quad 中心的归一化距离：0 = 中心，1 = quad 边（= halo 外缘）
    float d = length(vUv - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;

    // body：d < bodyRatio 实色，边缘抗锯齿；景深失焦 → 轻微加粗边缘 = 软散景（只柔边、不碰颜色）
    float aa = 0.012 + blurAmt * 0.15;
    float bodyMask = 1.0 - smoothstep(bodyRatio - aa, bodyRatio + aa, d);

    // halo：从 body 边缘的 haloPeak 平滑衰减到 quad 边的 0（对标 halo-soft 渐变尾巴）
    float halo = haloPeak * (1.0 - smoothstep(bodyRatio - 0.02, 1.0, d));

    // 合成：body 区取 fillOpacity（球体本体），halo 区取 halo；再乘整体 dim（播放淡出）。
    // 景深只柔化边缘(上面 aa)，不动 alpha/颜色 → 失焦不变暗、不褪色（仅"轻轻虚化"）
    float alpha = mix(halo, max(fillOpacity, haloPeak), bodyMask) * dim;
    if (alpha < 0.003) discard;

    // 调色：亮度 → 对比度（绕 0.5）→ 饱和度（绕亮度）。sRGB 直通，clamp 防溢出
    vec3 col = vColor * uBrightness;
    col = (col - 0.5) * uContrast + 0.5;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = clamp(mix(vec3(lum), col, uSaturation), 0.0, 1.0);

    // 景深不再改颜色：原"失焦变暗 + 去饱和"已移除（用户反馈对颜色影响太大）→ 失焦只柔边
    gl_FragColor = vec4(col, alpha);
  }
`;
