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
  // K3 深度三层模型（uDepthModel<0.5 时所有调制系数恒 1 → shader 逐字回到现状）：
  uniform float uDepthModel;  // 0=关（现状）/ 1=开（按逐球水下深度调制折射/月光）
  uniform float uPondDepth;   // 塘深：深度因子 d 的归一分母（与 water-level.ts depthFactor 同义）
  uniform float uRefrExp;     // 折射随深度指数 a：折射 ∝ d^a（近轻深重）
  uniform float uMoonExp;     // 月光随深度指数 b：月光 ∝ (1−d)^b（近强深弱）
  // K4 浮出水面球投影（R8，uSphereShowing<0.5 时不投 → 与现状逐字一致）：
  uniform float uSphereShowing; // 0=关（现状）/ 1=开（空中球在下方水面投柔影）
  uniform float uShadowStrength;// 柔影最大压暗量（0=无影，叠到合成色前 color -= shadow）

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

  // K3：给定屏幕 uv，取"对该像素影响最大的水下球"的深度因子 d∈[0,1]（贴水面=0、塘底=1）。
  // d = clamp((uWaterLevel - depthZ) / uPondDepth)，与 water-level.ts depthFactor 同式 →
  // 球 dim / 标题淡出 / 水面折射月光 三个消费方读同一 d、浮沉时一起连续变（统一 R4）。
  // 离球的水域（无球覆盖）落最近覆盖球的 d；都无 → 用一个中性 d（水位本身映射）保证平滑过渡。
  float computeDepth(vec2 uv) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    float best = -1.0; // 影响权重（取覆盖最强的球）
    float d = clamp(uWaterLevel / max(0.001, uPondDepth), 0.0, 1.0); // 无球区域的中性深度
    for (int i = 0; i < ${MAX_SPHERES}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      float cover = 1.0 - smoothstep(s.z * 0.82, s.z * 1.6, distance(px, s.xy)); // 球域软覆盖
      if (cover > best) {
        best = cover;
        float dd = clamp((uWaterLevel - s.w) / max(0.001, uPondDepth), 0.0, 1.0);
        d = mix(d, dd, cover); // 球内取球深、边缘平滑回中性深度
      }
    }
    return d;
  }

  // K4：空中球（s = uWaterLevel − depthZ > 0，即露出水面/悬空）在它下方水面投柔影。
  // 物理直觉——球悬在水面上方挡月光 → 正下方水面暗一块；球越高（s 越大），影越大、越散、越淡（半影变宽）。
  // 坐标：px=sim 像素（y 已翻转，screen-down = px.y 增大）；影心在球心略下方 (x, y + drop)，drop ∝ s。
  // 椭圆软斑：横向用球半径、纵向略压扁（贴水面斜投感）；高度 s 越大 → 半径放大 + 边缘更软 + 峰值更淡。
  float computeShadowMask(vec2 uv) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    float shadow = 0.0;
    for (int i = 0; i < ${MAX_SPHERES}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      float air = uWaterLevel - s.w;          // >0 = 球在空中（露出水面/悬空）
      if (air <= 0.0) continue;               // 水下/贴面球不投影（只空中带投）
      float rise = clamp(air / max(0.001, uPondDepth), 0.0, 1.0); // 归一空中高度 0..1
      float drop = s.z * (0.35 + 0.9 * rise);                     // 影心下移：越高投得越远
      vec2 ctr = vec2(s.x, s.y + drop);
      float rad = s.z * (0.85 + 0.7 * rise);                      // 越高影越大
      // 椭圆度量：纵向压扁 0.65（贴水面斜投），距离归一到半径
      vec2 dd = (px - ctr) / vec2(rad, rad * 0.65);
      float dist = length(dd);
      float soft = 0.45 + 0.45 * rise;        // 越高边缘越软（半影更宽）
      float spot = 1.0 - smoothstep(1.0 - soft, 1.0, dist);
      float peak = 1.0 - 0.45 * rise;         // 越高峰值越淡（光被散开）
      shadow = max(shadow, spot * peak);
    }
    return shadow;
  }

  void main() {
    float h  = texture2D(uHeight, vUv).r;
    float hx = texture2D(uHeight, vUv + vec2(uDelta.x, 0.0)).r;
    float hy = texture2D(uHeight, vUv + vec2(0.0, uDelta.y)).r;
    // 折射位移 ∝ 高度梯度(坡度) 并 clamp 上限：平水≈0、缓坡轻折、陡坡强折但不破。
    // ⚠ 旧版 -normalize(法线).xz 让"任何涟漪都满幅位移"→ 鼠标狂晃/微波被放大成麻点破洞，弃用。
    vec2 grad = vec2(hx - h, hy - h);
    float gmag = length(grad);
    float above = computeAbove(vUv);
    float sub = 1.0 - above;
    if (uDebug > 0.5) {                       // 调试：绿=水上(清晰)/红=水下(扭)，白线=水位 L
      float line = step(abs(vUv.y - uWaterLevel), 0.004);
      gl_FragColor = vec4(mix(vec3(0.7, 0.0, 0.0), vec3(0.0, 0.7, 0.0), above) + vec3(line), 1.0);
      return;
    }
    // K3 深度调制（uDepthModel<0.5 时 refrMod=moonMod=1.0 → 下面两式与现状逐字一致）：
    // 物理直觉——折射随水下深度变重(光程更长、扭得更狠)：refr ∝ d^a；clamp 上限防深球糊成噪点。
    //           月光高光随深度变弱(水面下衰减)：moon ∝ (1−d)^b，贴水面球高光最强、深球几乎无。
    float refrMod = 1.0;
    float moonMod = 1.0;
    if (uDepthModel > 0.5) {
      float d = computeDepth(vUv);
      refrMod = clamp(pow(d, uRefrExp), 0.0, 1.4);   // 上限 1.4：深球折射加强但不破（叠 disp 的 clamp 兜底）
      moonMod = pow(1.0 - d, uMoonExp);              // 近强深弱
    }
    vec2 disp = clamp(-grad * uPerturb * refrMod, -0.025, 0.025);
    // 折射采样；若采样落点是水上球，撤销偏移 → 不把水上球涂进水波（去重复鬼影）
    vec2 sampleUv = vUv + disp * sub;
    sampleUv = mix(sampleUv, vUv, computeAbove(sampleUv));
    // 月光高光：涟漪坡面朝月处发光（坡度方向，gmag gate → 平水无高光）
    vec2 dir = gmag > 1e-5 ? grad / gmag : vec2(0.0);
    float spec = pow(max(0.0, dot(-dir, normalize(vec2(-0.6, 1.0)))), 4.0) * smoothstep(0.0, 0.01, gmag);
    vec4 scene = texture2D(uScene, sampleUv);
    vec3 col = scene.rgb + vec3(spec * uSpec * sub * moonMod);
    // K4：空中球投影压暗水面（uSphereShowing<0.5 时跳过 → 与现状逐字一致）。
    // 只投在水面（× sub）：影落在水上球身上无意义，且 sub 让"被空中球自己遮住的那块"不重复压暗。
    if (uSphereShowing > 0.5) {
      float shadow = computeShadowMask(vUv) * uShadowStrength * sub;
      col = max(col - shadow, 0.0); // 不压成负值（红线：水下不压黑由亮度地板兜，这里只夺月光）
    }
    gl_FragColor = vec4(col, scene.a);
  }
`;
