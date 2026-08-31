import { pondFloorGlsl } from '../shaders/pond-floor-shaders';
import { waterLightGlsl } from '../shaders/water-light-glsl';

export const MAX_SPHERES = 48;

export const compositeMaskFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uBackgroundScene; // 不含球体的背景 FBO
  uniform sampler2D uSphereScene;     // 预乘 alpha 水下球 FBO
  uniform sampler2D uAboveSphereScene;// 预乘 alpha 水上球 FBO
  uniform float uHasSpheres;           // 1 = 本帧有球体 pass
  uniform sampler2D uHeight;  // ping-pong 高度场
  uniform vec2  uDelta;       // (1/RES, 1/RES)
  uniform float uPerturb;     // 折射强度
  uniform float uSpec;        // 高光强度
  uniform float uWaterLevel;  // 「有效水位」（没入判定用，∈[EFF_LOW,EFF_HIGH]≈[-0.15,1.20]）→ 全 z 域两端可完全出水/没入
  uniform float uWaterLevelRaw;// 「原始水位」current∈[0,1]（只给 K6 缩放/debug 横线用，与 motes/plants/滴水缩放同步）
  uniform vec2  uViewport;    // 画面像素 (w,h)，= sim 坐标空间
  uniform int   uSphereCount;
  uniform vec4  uSpheres[${MAX_SPHERES}]; // 每球 (x, y, radius, depthZ)，xy/radius 为 sim 像素
  uniform float uVisualDim[${MAX_SPHERES}]; // SphereInstances 写入的整体可见度，效果权重只读此处
  uniform float uDebug;       // 1 = 遮罩调试（绿=水上/红=水下 + 水位横线）
  uniform float uDepthModel;  // K3 深度模型：0=关（现状）/ 1=开（按逐球水下深度调制折射/月光；<0.5 时调制系数恒 1=现状）
  uniform float uPondDepth;   // 塘深：深度因子 d 的归一分母（与 water-level.ts depthFactor 同义）
  uniform float uRefrExp;     // 折射随深度指数 a：折射 ∝ d^a（近轻深重）
  uniform float uMoonExp;     // 月光随深度指数 b：月光 ∝ (1−d)^b（近强深弱）
  uniform float uSphereShowing; // K4 投影：0=关（现状）/ 1=开（空中球在下方水面投柔影）
  uniform float uShadowStrength;// 柔影最大压暗量（0=无影，叠到合成色前 color -= shadow）
  uniform float uShadowHeight;  // K4 高度对投影的影响总增益（拉高=层级差更显：偏移/半影/模糊/衰减都更随高度）
  uniform float uShadowOcclude; // K4-B 挡月光：球挡住下方月光/焦散（乘性夺光，暗处不动只压亮）
  uniform float uShadowGlow;    // K4-C 反光晕：球在下方水面投淡冷光（加亮，暗塘更显）
  uniform float uShadowContact; // K4-D 接触影：紧贴球的小柔影（g=0，无视差/不随高度涨）
  uniform float uCaustics;        // K5 月光焦散：0=关（现状）/ 1=开（冷白漫反射+焦散流光叠到水面）
  uniform float uCausticsStrength;// 焦散光照总强度（0=无光，乘到整层冷白增量上）
  uniform float uTime;            // 秒（state.clock）→ 光池/光带缓慢游走，静止水面也"活"
  uniform float uZoomAmount;      // K6 缩放：0=关（现状）/ >0=按水位绕中心缩放高度场采样（升放大/降缩小）
  uniform float uPondFloor;        // K10 塘底：0=关（纯黑现状）/ 1=开（水域叠极淡静止暗纹，被涟漪折射产生视差）
  uniform float uPondFloorStrength;// 塘底暗纹强度（极小，只加微妙冷暗纵深，不压亮整体）
  uniform float uPondFloorStyle;   // K10 塘底花纹（0 细沙偏亮/1 彩晕/2 鹅卵石/3 沙纹/4 矿脉）
  uniform float uMoonReflect;        // K11 月光倒影：0=关（现状）/ 1=开（大柔冷白月华，被涟漪扭碎、随 K6 缩放）
  uniform float uMoonReflectStrength;// 月光倒影强度（≤0.5 克制；偏画面一侧、低不透明 → 不盖过球）
  uniform float uBallLightBelow;     // 月光对"水下球"的增亮衰减（0..1）；水上球严格为 0
  uniform float uWaveOnBall;         // 水下球波纹增强：水面涟漪明暗(梯度·朝月)乘性荡漾过水下球面，提升"水下感"；0=关
  uniform vec4  uQuietWaves[5];      // P9 v4.1：最多五条独立安静波
  uniform vec4  uP9Arcs[5];          // P9 v4：最多五条屏外超大圆弧浪
  uniform vec4  uP9Water;            // P9 v4：静浪辅助参数
  uniform vec4  uP9Caustic;          // P9 v2：焦散分裂、进度、增亮、退暗

  // K3：取"对该像素影响最大的水下球"的深度因子 d∈[0,1]（贴水面=0、塘底=1），d=clamp((uWaterLevel-depthZ)/uPondDepth)
  // 与 water-level.ts depthFactor 同式 → 球 dim/标题淡出/水面折射月光 三消费方读同一 d、浮沉一起连续变（统一 R4）。
  // 无球覆盖的水域落最近覆盖球的 d；都无 → 用中性 d（水位映射）保平滑。
  float computeDepth(vec2 uv) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    float best = -1.0; // 影响权重（取覆盖最强的球）
    float d = clamp(uWaterLevel / max(0.001, uPondDepth), 0.0, 1.0); // 无球区域的中性深度
    for (int i = 0; i < ${MAX_SPHERES}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      float cover = 1.0 - smoothstep(s.z * 0.82, s.z * 1.6, distance(px, s.xy)); // 几何深度不随透明度跳动
      if (cover > best) {
        best = cover;
        float dd = clamp((uWaterLevel - s.w) / max(0.001, uPondDepth), 0.0, 1.0);
        d = mix(d, dd, cover); // 球内取球深、边缘平滑回中性深度
      }
    }
    return d;
  }

  // K4 投影 computeShadowMask / K5 焦散 computeCaustics / K11 倒影 moonReflectTex
  // 注入自 ../shaders/water-light-glsl（腾行数；这些函数引用本 shader 上方声明的 uniform）。
  ${waterLightGlsl(MAX_SPHERES)}

  // K10 塘底花纹（5 套，pondFloorColor 注入自 shaders/pond-floor-shaders.ts；返回 vec3 冷暗色，main ×强度×sub）。
  ${pondFloorGlsl}

  void main() {
    // K6：按水位绕中心缩放「高度场采样 UV」(只缩水层、球不动)。zoom=max(0.35,1+(原始水位−0.5)·uZoomAmount)：
    // 高→收缩放大溢出/低→外撑缩小露更多塘面；下限 0.35(=ZOOM_MIN) 防大幅度/低水位时 zoom≤0 致采样翻转。
    // OFF(uZoomAmount=0)：hUv=vUv、edgeWin=1 → 下面采样/梯度与现状逐字一致。
    vec2 hUv = vUv;
    float edgeWin = 1.0; // 池内=1；缩小越界 [0,1] 的池外→0（涟漪软淡出成静水，不复制涟漪、不留硬边）
    if (uZoomAmount > 0.0) {
      float zoom = max(0.35, 1.0 + (uWaterLevelRaw - 0.5) * uZoomAmount); // 用原始水位 + 下限兜底
      hUv = (vUv - 0.5) / zoom + 0.5;                    // 绕中心缩放采样
      // 缩小(zoom<1)越界 [0,1]：不再镜像平铺(那会复制出"9 宫格"的重复涟漪)，改 clamp 采样 + 把涟漪在边缘
      // 软淡出成静水（edgeWin→0）→ 池外是连续平静水面、无重复涟漪、无 clamp 边缘的梯度尖峰/回弹线。
      vec2 fw = smoothstep(0.0, 0.06, hUv) * (1.0 - smoothstep(0.94, 1.0, hUv));
      edgeWin = fw.x * fw.y;
      hUv = clamp(hUv, 0.0, 1.0);
    }
    // 梯度步长恒用 uDelta（场内自然梯度）→ 缩放只改涟漪位置/大小、不改亮度（曾用 uDelta/zoom 致降水位全屏变亮，弃用）。
    float h  = texture2D(uHeight, hUv).r;
    float hx = texture2D(uHeight, hUv + vec2(uDelta.x, 0.0)).r;
    float hy = texture2D(uHeight, hUv + vec2(0.0, uDelta.y)).r;
    vec2 grad = vec2(hx - h, hy - h) * edgeWin; // ×edgeWin：池外梯度→0=静水（无折射/无高光、无 clamp 边缘尖峰）
    float quietFront = 0.0, p9Wave = 0.0;
    float quietEnergy = 0.0;
    for (int qi = 0; qi < 5; qi++) {
      vec4 qv = uQuietWaves[qi];
      if (qv.w <= 0.001) continue;
      vec2 q = vUv - qv.xy; q.x *= uViewport.x / max(1.0, uViewport.y);
      float qr = qv.z * 1.25, qd = length(q);
      float interior = 1.0 - smoothstep(qr - 0.06, qr + 0.04, qd);
      float front = 1.0 - smoothstep(0.015, 0.12, abs(qd - qr));
      quietFront = max(quietFront, front * qv.w);
      quietEnergy = max(quietEnergy, qv.w);
      grad *= 1.0 - clamp(max(interior * 0.72, front) * qv.w, 0.0, 0.98);
    }
    vec2 sphereGrad = grad; // T 的屏外巨浪只扫水面，不把已隐藏音乐球的白底重新照出来。
    for (int ai = 0; ai < 5; ai++) {
      vec4 av = uP9Arcs[ai];
      if (av.x <= 0.001) continue;
      vec2 center = vec2(0.5) + vec2(cos(av.z), sin(av.z)) * 2.35;
      vec2 aq = vUv - center;
      float arcWave = exp(-pow((length(aq) - (1.35 + av.y * 2.0)) / 0.075, 2.0)) * av.x;
      p9Wave += arcWave;
      grad += normalize(aq + 0.0001) * arcWave * 0.016;
    }
    float gmag = length(grad);
    if (uDebug > 0.5) { // 真实 target：绿=水上，红=水下，蓝=RGB 超出 Alpha（合成契约失配）
      vec4 aboveTex = texture2D(uAboveSphereScene, vUv);
      vec4 belowTex = texture2D(uSphereScene, vUv);
      float aboveRgb = max(aboveTex.r, max(aboveTex.g, aboveTex.b));
      float belowRgb = max(belowTex.r, max(belowTex.g, belowTex.b));
      float above = max(aboveTex.a, aboveRgb);
      float below = max(belowTex.a, belowRgb);
      float mismatch = max(max(aboveRgb - aboveTex.a, 0.0), max(belowRgb - belowTex.a, 0.0));
      float line = step(abs(vUv.y - uWaterLevelRaw), 0.004);
      gl_FragColor = vec4(vec3(below, above, mismatch) + vec3(line), 1.0);
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
    vec2 backgroundUv = vUv + disp;
    // 月光高光：涟漪坡面朝月处发光（坡度方向，gmag gate → 平水无高光）
    vec2 dir = gmag > 1e-5 ? grad / gmag : vec2(0.0);
    float spec = pow(max(0.0, dot(-dir, normalize(vec2(-0.6, 1.0)))), 4.0) * smoothstep(0.0, 0.01, gmag);
    // K4 空中球→水面"投影"软盘 mask（A 暗影 / B 挡月光 / C 反光晕 共用；含视差/温和软化/水光打碎）。
    float aMask = (uSphereShowing > 0.5 || uShadowOcclude > 0.5 || uShadowGlow > 0.5)
      ? computeShadowMask(vUv, grad, uShadowHeight) : 0.0;
    // B 挡月光：夺球下方"月光高光+焦散"两项光（暗处无光可夺→只在有光处显；验收需同开 K5 或划水产高光，否则看不出）。
    float occ = uShadowOcclude > 0.5 ? aMask * clamp(uShadowStrength * 3.0, 0.0, 1.0) : 0.0;
    vec4 scene = texture2D(uBackgroundScene, backgroundUv);
    // K10「亮底」：暗塘底(非球)区域用塘底花纹 mix 替换 → 明亮/彩色的水底（不再"黑上加微光"那种灰雾）。
    // 球比暗底亮 → 用亮度阈值 notBase 保护，不被塘底覆盖。作 base 放在月光/焦散之下 = 真水底。<0.5 跳过=现状。
    // 塘底坐标用 vUv+涟漪折射 disp（静止、只被涟漪折射 → 动水面在静止塘底上产生视差）。
    vec3 base = scene.rgb;
    if (uPondFloor > 0.5) {
      float notBase = smoothstep(0.08, 0.20, max(base.r, max(base.g, base.b))); // 球/亮物≈1（保留），暗塘底≈0（露塘底）
      // 去掉 sub 门控 → 塘底也垫在「出水球清晰区」下：球淡出/隐藏时那块变暗 → notBase→0 → 露水底花纹而非黑底。
      // 不透明球 notBase≈1 不受影响；水域 sub=1 时与原式逐字等价（此改仅在球圆盘内、且该处变暗时生效）。
      base = mix(base, pondFloorColor(vUv + disp, uPondFloorStyle), uPondFloorStrength * (1.0 - notBase));
    }
    vec3 col = base + vec3(spec * uSpec * moonMod * (1.0 - occ)) + vec3(0.62, 0.76, 0.86) * p9Wave * 0.3;
    vec3 quietColor = vec3(0.92, 0.96, 1.0);
    col += quietColor * quietFront * quietEnergy * 0.34;
    // A 暗影：冷向减光（多减暖留冷、影偏蓝灰不死黑；暗塘上弱、亮处显）
    if (uSphereShowing > 0.5) col = max(col - aMask * uShadowStrength * vec3(1.1, 1.0, 0.82), 0.0);
    // C 反光晕：加冷光（暗塘上加光比减光更显，像球的光落在下方水面）
    if (uShadowGlow > 0.5) col += aMask * uShadowStrength * 0.6 * vec3(0.55, 0.72, 0.95);
    // D 接触影：g=0 紧贴球的小柔影（无视差、不随高度涨），冷向减光
    if (uShadowContact > 0.5) col = max(col - computeShadowMask(vUv, grad, 0.0) * uShadowStrength * vec3(1.1, 1.0, 0.82), 0.0);
    // K5/K11 月光两效（焦散+倒影）：各算一次冷白增量，水面路径与球路径共用。uCaustics/uMoonReflect<0.5 时该项=0（=现状跳过）。
    vec3 causV = (uCaustics > 0.5 ? computeCaustics(vUv, grad, uTime) * uCausticsStrength : 0.0) * vec3(0.55, 0.72, 0.95);
    vec3 moonV = (uMoonReflect > 0.5 ? moonReflectTex(hUv, grad, uTime) * uMoonReflectStrength * edgeWin : 0.0) * vec3(0.91, 0.95, 1.0);
    if (uP9Caustic.x > 0.001) {
      vec2 splitDir = vec2(cos(uP9Caustic.y * 6.283), sin(uP9Caustic.y * 6.283)) * uP9Caustic.x * 0.08;
      vec3 splitV = (computeCaustics(vUv + splitDir, grad, uTime) + computeCaustics(vUv - splitDir, grad, uTime)
        + computeCaustics(vUv + vec2(-splitDir.y, splitDir.x), grad, uTime)) * uCausticsStrength * vec3(0.55, 0.72, 0.95) / 3.0;
      float splitLife = 1.0 - smoothstep(0.68, 1.0, uP9Caustic.y);
      causV = splitV * splitLife;
    }
    causV *= 1.0 + uP9Caustic.z * 3.4;
    causV *= 1.0 - clamp(uP9Caustic.w, 0.0, 0.92);
    // 背景始终走完整水面路径；球体在最后以预乘 alpha 覆盖，不再从背景抠洞。
    col += causV * (1.0 - occ);
    col += moonV;
    // 水下球只吃 grad=0 的环境月光；局部光受预乘 headroom 限制。
    vec3 causAmb = (uCaustics > 0.5 ? computeCaustics(vUv, vec2(0.0), uTime) * uCausticsStrength : 0.0) * vec3(0.55, 0.72, 0.95);
    vec3 moonAmb = (uMoonReflect > 0.5 ? moonReflectTex(hUv, vec2(0.0), uTime) * uMoonReflectStrength * edgeWin : 0.0) * vec3(0.91, 0.95, 1.0);
    float ballAtten = uBallLightBelow;
    vec3 ballLight = dot(causAmb, vec3(0.299, 0.587, 0.114)) >= dot(moonAmb, vec3(0.299, 0.587, 0.114)) ? causAmb : moonAmb;
    // 水下球"水下感"增强：水面涟漪明暗(梯度·朝月，正=亮带/负=暗带 → 完整波纹荡漾，比 spec 单取高光更"水")乘性打到水下球面。
    // 只给水下球增加波纹光，不把波纹光写回背景。
    float sphereGmag = length(sphereGrad);
    vec2 sphereDir = sphereGmag > 1e-5 ? sphereGrad / sphereGmag : vec2(0.0);
    float waveBall = dot(sphereDir, normalize(vec2(-0.6, 1.0))) * smoothstep(0.0, 0.004, sphereGmag);
    if (uHasSpheres > 0.5) {
      vec2 sphereDisp = clamp(-sphereGrad * uPerturb * refrMod, -0.025, 0.025);
      vec4 sphere = texture2D(uSphereScene, vUv + sphereDisp); // T 巨浪不再扭曲隐藏球取样，杜绝白底回闪
      float waveDelta = waveBall * uWaveOnBall;
      if (waveDelta >= 0.0) {
        sphere.rgb += max(vec3(sphere.a) - sphere.rgb, vec3(0.0)) * min(waveDelta, 1.0);
      } else {
        sphere.rgb *= max(0.0, 1.0 + waveDelta);
      }
      vec3 waterLight = clamp(ballLight * ballAtten, 0.0, 1.0);
      sphere.rgb += max(vec3(sphere.a) - sphere.rgb, vec3(0.0)) * waterLight;
      sphere.rgb = clamp(sphere.rgb, vec3(0.0), vec3(sphere.a));
      vec3 wetWithSphere = sphere.rgb + col * (1.0 - sphere.a);
      vec4 aboveSphere = texture2D(uAboveSphereScene, vUv);
      vec3 outRgb = aboveSphere.rgb + wetWithSphere * (1.0 - aboveSphere.a);
      gl_FragColor = vec4(outRgb, 1.0);
      return;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;
