/**
 * H3 — 水位深度遮罩合成 shader（WaterDistort 专用）。
 *
 * 不渲离屏 z 图（换材质在 R3F+InstancedMesh 上不稳）；改为把球坐标/半径/深度当 uniform 数组传进来，
 * 每像素遍历球算"露出水面程度 above"——z>L 露出 → above≈1 → 不扭(清晰)；z≤L 水下 → 涟漪折射 + 月光高光。
 * 防鬼影：折射采样落点若是水上球则撤销偏移 → 水下像素不把水上球涂进水波（去重复）。
 */

import { pondFloorGlsl } from '../shaders/pond-floor-shaders';
import { waterLightGlsl } from '../shaders/water-light-glsl';

export const MAX_SPHERES = 48;

export const compositeMaskFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;   // 内容 FBO（真场景）
  uniform sampler2D uHeight;  // ping-pong 高度场
  uniform vec2  uDelta;       // (1/RES, 1/RES)
  uniform float uPerturb;     // 折射强度
  uniform float uSpec;        // 高光强度
  uniform float uWaterLevel;  // 「有效水位」（没入判定用，∈[EFF_LOW,EFF_HIGH]≈[-0.15,1.20]）→ 全 z 域两端可完全出水/没入
  uniform float uWaterLevelRaw;// 「原始水位」current∈[0,1]（只给 K6 缩放/debug 横线用，与 motes/plants/滴水缩放同步）
  uniform vec2  uViewport;    // 画面像素 (w,h)，= sim 坐标空间
  uniform int   uSphereCount;
  uniform vec4  uSpheres[${MAX_SPHERES}]; // 每球 (x, y, radius, depthZ)，xy/radius 为 sim 像素
  uniform float uSphereVis[${MAX_SPHERES}]; // 每球遮罩可见度（播放时非播放球→0；乘遮罩贡献=原地淡出，修"暗斑收缩"）
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
  uniform float uBallLightAbove;     // 月光对"水上球"的增亮衰减（0..1，独立于强度参数）
  uniform float uBallLightBelow;     // 月光对"水下球"的增亮衰减（0..1）
  uniform float uWaveOnBall;         // 水下球波纹增强：水面涟漪明暗乘性荡漾过水下球面，提升"水下感"；0=关

  // 给定屏幕 uv，遍历球算"露出水面程度"（0=水下/1=水上）
  float computeAbove(vec2 uv) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    float a = 0.0;
    for (int i = 0; i < ${MAX_SPHERES}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      // above=1-submerge，与 water-level.ts getSubmerge 同阈值/曲线 → DOM 标题没入与 GL 折射清晰完全同步（不错位）
      float st = clamp((uWaterLevel - s.w + 0.02) / 0.12, 0.0, 1.0);
      float depthMask = 1.0 - st * st * (3.0 - 2.0 * st);
      float edge = 1.0 - smoothstep(s.z * 0.82, s.z, distance(px, s.xy));        // 圆形软边
      a = max(a, depthMask * edge * uSphereVis[i]);  // ×vis：球淡出时遮罩原地变淡（不缩半径）
    }
    return a;
  }

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
      float cover = (1.0 - smoothstep(s.z * 0.82, s.z * 1.6, distance(px, s.xy))) * uSphereVis[i]; // 球域软覆盖 ×vis（淡出球不参与深度）
      if (cover > best) {
        best = cover;
        float dd = clamp((uWaterLevel - s.w) / max(0.001, uPondDepth), 0.0, 1.0);
        d = mix(d, dd, cover); // 球内取球深、边缘平滑回中性深度
      }
    }
    return d;
  }

  // K4 投影 computeShadowMask / K5 焦散 computeCaustics / K11 倒影 moonReflectTex / 球遮罩 ballMask
  // 注入自 ../shaders/water-light-glsl（腾行数；这些函数引用本 shader 上方声明的 uniform）。
  ${waterLightGlsl(MAX_SPHERES)}

  // K10 塘底花纹（5 套，pondFloorColor 注入自 shaders/pond-floor-shaders.ts；返回 vec3 冷暗色，main ×强度×sub）。
  ${pondFloorGlsl}

  void main() {
    // K6：按水位「放大」高度场采样 UV(只缩水层、球不动)。zoom = 1 + 原始水位·uZoomAmount，**恒 ≥ 1（只放大不缩小）**：
    // 水位 0 → zoom 1（看整片塘=满屏涟漪）；水位升 → 放大中心（"升放大"）。zoom≥1 → hUv 恒在 [0,1] →
    // **任何缩放幅度下涟漪都铺满全屏**（不再缩出中间一小块/9 宫格，故无需 edge 淡出/clamp）。
    // OFF(uZoomAmount=0)：zoom=1、hUv=vUv → 下面采样/梯度与现状逐字一致。
    vec2 hUv = vUv;
    if (uZoomAmount > 0.0) {
      float zoom = 1.0 + uWaterLevelRaw * uZoomAmount;   // ≥1：水位 0=全塘、水位 1=最大放大
      hUv = (vUv - 0.5) / zoom + 0.5;                    // 绕中心放大采样（恒在 [0,1]，全屏皆有效涟漪）
    }
    // 梯度步长恒用 uDelta（场内自然梯度）→ 缩放只改涟漪位置/大小、不改亮度（曾用 uDelta/zoom 致降水位全屏变亮，弃用）。
    float h  = texture2D(uHeight, hUv).r;
    float hx = texture2D(uHeight, hUv + vec2(uDelta.x, 0.0)).r;
    float hy = texture2D(uHeight, hUv + vec2(0.0, uDelta.y)).r;
    vec2 grad = vec2(hx - h, hy - h);
    float gmag = length(grad);
    float above = computeAbove(vUv);
    float sub = 1.0 - above;
    // 【遮挡契约·勿破】水是一层半透明面：above=可见出水球遮罩(含 1−没入；没入/淡出球=0)、sub=1−above。
    //   水下球 & 开阔水面(sub=1)：水面一切派生效果(折射 disp / 高光 spec / 焦散 / 倒影 / 亮塘底)照常显
    //     → "从上到下先看到半透明水波，透过水波看到球"。
    //   出水球(sub=0=不透明、挡在水面之上)：上述全部 ×sub=0 → 球上无任何水波/高光，只见球本色；球下水面照常起波。
    //   过水线 sub 连续 → 出入水平滑不跳变。⚠ 今后新增任何"水面/涟漪"派生效果必须 ×sub，否则会爬到出水球上破坏遮挡（本问题反复复发的根因）。
    if (uDebug > 0.5) {                       // 调试：绿=水上(清晰)/红=水下(扭)，白线=原始水位
      float line = step(abs(vUv.y - uWaterLevelRaw), 0.004);
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
    // K4 空中球→水面"投影"软盘 mask（A 暗影 / B 挡月光 / C 反光晕 共用；含视差/温和软化/水光打碎）。
    float aMask = (uSphereShowing > 0.5 || uShadowOcclude > 0.5 || uShadowGlow > 0.5)
      ? computeShadowMask(vUv, grad, uShadowHeight) * sub : 0.0;
    // B 挡月光：夺球下方"月光高光+焦散"两项光（暗处无光可夺→只在有光处显；验收需同开 K5 或划水产高光，否则看不出）。
    float occ = uShadowOcclude > 0.5 ? aMask * clamp(uShadowStrength * 3.0, 0.0, 1.0) : 0.0;
    vec4 scene = texture2D(uScene, sampleUv);
    // K10「亮底」：暗塘底(非球)区域用塘底花纹 mix 替换 → 明亮/彩色的水底（不再"黑上加微光"那种灰雾）。
    // 球比暗底亮 → 用亮度阈值 notBase 保护，不被塘底覆盖。作 base 放在月光/焦散之下 = 真水底。<0.5 跳过=现状。
    // 塘底坐标用 vUv+涟漪折射 disp（静止、只被涟漪折射 → 动水面在静止塘底上产生视差）。
    vec3 base = scene.rgb;
    if (uPondFloor > 0.5) {
      float notBase = smoothstep(0.08, 0.20, max(base.r, max(base.g, base.b))); // 球/亮物≈1（保留），暗塘底≈0（露塘底）
      base = mix(base, pondFloorColor(vUv + disp * sub, uPondFloorStyle), uPondFloorStrength * sub * (1.0 - notBase));
    }
    vec3 col = base + vec3(spec * uSpec * sub * moonMod * (1.0 - occ)); // 月光高光 ×sub（遮挡契约）：水下球/水面显，出水球为 0；被"挡月光"夺
    // A 暗影：冷向减光（多减暖留冷、影偏蓝灰不死黑；暗塘上弱、亮处显）
    if (uSphereShowing > 0.5) col = max(col - aMask * uShadowStrength * vec3(1.1, 1.0, 0.82), 0.0);
    // C 反光晕：加冷光（暗塘上加光比减光更显，像球的光落在下方水面）
    if (uShadowGlow > 0.5) col += aMask * uShadowStrength * 0.6 * vec3(0.55, 0.72, 0.95);
    // D 接触影：g=0 紧贴球的小柔影（无视差、不随高度涨），冷向减光
    if (uShadowContact > 0.5) col = max(col - computeShadowMask(vUv, grad, 0.0) * sub * uShadowStrength * vec3(1.1, 1.0, 0.82), 0.0);
    // K5/K11 月光两效（焦散+倒影）：各算一次冷白增量，水面/球路径共用。<0.5 时=0=现状跳过。
    vec3 causV = (uCaustics > 0.5 ? computeCaustics(vUv, grad, uTime) * uCausticsStrength : 0.0) * vec3(0.55, 0.72, 0.95);
    vec3 moonV = (uMoonReflect > 0.5 ? moonReflectTex(hUv, grad, uTime) * uMoonReflectStrength : 0.0) * vec3(0.91, 0.95, 1.0);
    // 水面（保持现状·两效叠加）：×sub 只水域、焦散×(1−occ) 被挡月光夺；×(1−ballCover) 把球抠出水面路径 → 球改走下面"球路径"。开阔水面 ballCover≈0 → 与现状一致。
    vec2 bm = ballMask(vUv);
    float ballCover = bm.x;
    col += causV * sub * (1.0 - occ) * (1.0 - ballCover);
    col += moonV * sub * (1.0 - ballCover);
    // 球路径：球只吃「无涟漪」环境月光（grad=0 → 去掉 slope/扭动等涟漪响应项）→ 点击涟漪时球上不起高光（水上球纯净）。
    // 取两效"增亮更高者"(非叠加) × 衰减(水上 uBallLightAbove/水下 uBallLightBelow，独立于强度) × 覆盖；aboveFrac=出水比例 → 水上/水下衰减插值。
    vec3 causAmb = (uCaustics > 0.5 ? computeCaustics(vUv, vec2(0.0), uTime) * uCausticsStrength : 0.0) * vec3(0.55, 0.72, 0.95);
    vec3 moonAmb = (uMoonReflect > 0.5 ? moonReflectTex(hUv, vec2(0.0), uTime) * uMoonReflectStrength : 0.0) * vec3(0.91, 0.95, 1.0);
    float aboveFrac = ballCover > 1e-4 ? clamp(bm.y / ballCover, 0.0, 1.0) : 0.0;
    float ballAtten = mix(uBallLightBelow, uBallLightAbove, aboveFrac);
    vec3 ballLight = dot(causAmb, vec3(0.299, 0.587, 0.114)) >= dot(moonAmb, vec3(0.299, 0.587, 0.114)) ? causAmb : moonAmb;
    col += ballLight * ballAtten * ballCover;
    // 水下球"水下感"增强：水面涟漪明暗(梯度·朝月，亮带+暗带)乘性荡漾过水下球面。×sub 只水下、×ballCover 只球。
    float waveBall = dot(dir, normalize(vec2(-0.6, 1.0))) * smoothstep(0.0, 0.004, gmag);
    col *= 1.0 + waveBall * uWaveOnBall * sub * ballCover;
    gl_FragColor = vec4(col, scene.a);
  }
`;
