/**
 * H3 — 水位深度遮罩合成 shader（WaterDistort 专用）。
 *
 * 不渲离屏 z 图（换材质/override 在 R3F+InstancedMesh 上不稳）；改为把球的坐标/半径/深度
 * 直接当 uniform 数组传进来，每像素遍历球算"露出水面程度 above"——
 * z>L（露出水面）→ above≈1 → 不扭（清晰）；z≤L（水下）→ 全屏涟漪折射 + 月光高光。
 *
 * 防鬼影：折射采样前先查采样落点是不是水上球，是的话撤销偏移 → 水下像素不会把水上球涂进水波（去重复）。
 */

export const MAX_SPHERES = 48;

export const compositeMaskFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;   // 内容 FBO（真场景）
  uniform sampler2D uHeight;  // ping-pong 高度场
  uniform vec2  uDelta;       // (1/RES, 1/RES)
  uniform float uPerturb;     // 折射强度
  uniform float uSpec;        // 高光强度
  uniform float uWaterLevel;  // 水位 L ∈[0,1]
  uniform vec2  uViewport;    // 画面像素 (w,h)，= sim 坐标空间
  uniform int   uSphereCount;
  uniform vec4  uSpheres[${MAX_SPHERES}]; // 每球 (x, y, radius, depthZ)，xy/radius 为 sim 像素
  uniform float uDebug;       // 1 = 遮罩调试（绿=水上/红=水下 + 水位横线）

  // 给定屏幕 uv，遍历球算"露出水面程度"（0=水下/1=水上）
  float computeAbove(vec2 uv) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    float a = 0.0;
    for (int i = 0; i < ${MAX_SPHERES}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      // above = 1 - submerge，与 water-level.ts getSubmerge 同阈值/曲线 →
      // DOM 标题没入 与 GL 折射清晰 完全同步（否则两者在水位带内错位：编号先浮出、圆圈后浮出）
      float st = clamp((uWaterLevel - s.w + 0.02) / 0.12, 0.0, 1.0);
      float depthMask = 1.0 - st * st * (3.0 - 2.0 * st);
      float edge = 1.0 - smoothstep(s.z * 0.82, s.z, distance(px, s.xy));        // 圆形软边
      a = max(a, depthMask * edge);
    }
    return a;
  }

  void main() {
    float h  = texture2D(uHeight, vUv).r;
    float hx = texture2D(uHeight, vUv + vec2(uDelta.x, 0.0)).r;
    float hy = texture2D(uHeight, vUv + vec2(0.0, uDelta.y)).r;
    vec3 dx = vec3(uDelta.x, hx - h, 0.0);
    vec3 dy = vec3(0.0, hy - h, uDelta.y);
    vec2 offset = -normalize(cross(dy, dx)).xz;
    float above = computeAbove(vUv);
    float sub = 1.0 - above;
    if (uDebug > 0.5) {                       // 调试：绿=水上(清晰)/红=水下(扭)，白线=水位 L
      float line = step(abs(vUv.y - uWaterLevel), 0.004);
      gl_FragColor = vec4(mix(vec3(0.7, 0.0, 0.0), vec3(0.0, 0.7, 0.0), above) + vec3(line), 1.0);
      return;
    }
    // 折射采样；若采样落点是水上球，撤销偏移 → 不把水上球涂进水波（去重复鬼影）
    vec2 sampleUv = vUv + offset * uPerturb * sub;
    sampleUv = mix(sampleUv, vUv, computeAbove(sampleUv));
    float spec = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);
    gl_FragColor = texture2D(uScene, sampleUv) + vec4(vec3(spec * uSpec * sub), 0.0);
  }
`;
