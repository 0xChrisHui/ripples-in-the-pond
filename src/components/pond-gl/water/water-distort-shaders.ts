/**
 * H3 — 水位深度遮罩合成 shader（WaterDistort 专用）。
 *
 * 不渲离屏 z 图（换材质在 R3F+InstancedMesh 上不稳）；改为把球坐标/半径/深度当 uniform 数组传进来，
 * 每像素遍历球算"露出水面程度 above"——z>L 露出 → above≈1 → 不扭(清晰)；z≤L 水下 → 涟漪折射 + 月光高光。
 * 防鬼影：折射采样落点若是水上球则撤销偏移 → 水下像素不把水上球涂进水波（去重复）。
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
  uniform float uMoonReflect;        // K11 月光倒影：0=关（现状）/ 1=开（大柔冷白月华，被涟漪扭碎、随 K6 缩放）
  uniform float uMoonReflectStrength;// 月光倒影强度（≤0.5 克制；偏画面一侧、低不透明 → 不盖过球）

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
      a = max(a, depthMask * edge);
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
      float cover = 1.0 - smoothstep(s.z * 0.82, s.z * 1.6, distance(px, s.xy)); // 球域软覆盖
      if (cover > best) {
        best = cover;
        float dd = clamp((uWaterLevel - s.w) / max(0.001, uPondDepth), 0.0, 1.0);
        d = mix(d, dd, cover); // 球内取球深、边缘平滑回中性深度
      }
    }
    return d;
  }

  // K4：空中球(air=depthZ−uWaterLevel>0)在下方水面投软影；水下/贴面球不投。月光=远光源(近平行)→按远光源建模：
  //  air 越大 → ①视差偏移越远(主高度线索) ②大小≈恒定(平行光无放大) ③透起伏水面/雾→温和变糊 ④环境补光→温和变淡。
  //  (旧近光源版"越高越大越淡的盘"=物理错，已纠正；辨析见 docs/JOURNAL.md 2026-06-18。)uShadowHeight=g 高度增益；grad=水面坡度。
  float computeShadowMask(vec2 uv, vec2 grad, float g) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    vec2 offDir = normalize(vec2(0.5, 1.0)); // 背光方向(右下，月光自左上)：影偏移方向
    float vh = max(1.0, uViewport.y);
    float shadow = 0.0;
    for (int i = 0; i < ${MAX_SPHERES}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      float air = s.w - uWaterLevel;          // >0 = 悬空高度（z 归一），越大离水面越远
      if (air <= 0.0) continue;               // 水下/贴面球不投影
      float t = clamp(air / 0.5, 0.0, 1.0);   // 归一高度（0.5≈最高，覆盖整层级差）
      vec2 warp = clamp(grad * (1.0 + 3.0 * t * g), -0.02, 0.02) * uViewport; // ③透起伏水面/雾看影→随高温和变糊
      vec2 ctr = s.xy + offDir * (s.z * 0.15 + air * vh * 0.08 * g);          // ①视差：偏移∝真实高度/tanθ（月光仰角≈70°；主高度线索）
      vec2 dd = (px + warp - ctr) / vec2(s.z, s.z * 0.55);                   // ②大小≈恒定（远光源平行光无放大；纵压扁=斜投椭圆）
      float umbra = 0.85 - 0.3 * t;            // 仅温和变软（天空环境光填半影）：贴面 0.85 → 高处 0.55
      float spot = 1.0 - smoothstep(umbra, 1.0, length(dd));
      shadow = max(shadow, spot * (1.0 - 0.35 * t)); // ③温和变淡（环境补光）：高处 ×0.65，不大幅
    }
    // 水光网纹打碎（亮处被光"打穿" → 水面感、平水也活），四种投影模式共用此 mask。
    float sAspect = uViewport.x / max(1.0, uViewport.y);
    vec2 wp = uv * vec2(8.0 * sAspect, 8.0);
    float lite = sin(wp.x + uTime * 0.5) + sin(wp.y * 0.9 - uTime * 0.4) + sin((wp.x + wp.y) * 0.6 + uTime * 0.6);
    return shadow * (1.0 - 0.5 * smoothstep(0.4, 2.2, lite));
  }

  // K5：月光焦散光照（参考 flower-water-ripples FSH 的 light/spec/band/pool，翻成夜塘月光冷白版）。
  // 返回一个标量"冷白增量"——main 里乘冷白 RGB 叠加（只加亮、不上色、不压暗 → 不破"水下不压黑"）。
  // 四层：①漫反射(坡面朝月微提亮) ②波峰高光(陡坡尖峰增辉) ③飘移对角光带 ④缓慢游走的月光池。
  // 后两层用 uTime 自驱，平水/静止时水面仍有缓慢流光（焦散感）；前两层 gate 在涟漪梯度上、平水≈0。
  float computeCaustics(vec2 uv, vec2 grad, float time) {
    // ①焦散网纹（主体）：四层缓慢正弦干涉成胞状，pow 锐化成"细亮丝"，随时间流动→静水也"活"；按宽高比缩 uv 防宽屏拉长。
    float aspect = uViewport.x / max(1.0, uViewport.y);
    vec2 p = uv * vec2(7.0 * aspect, 7.0);
    float t = time * 0.4;
    float w = sin(p.x + t) + sin(p.y - t * 0.9)
            + sin((p.x + p.y) * 0.7 + t * 1.1)
            + sin((p.x - p.y) * 0.6 - t * 0.7);
    float web = pow(clamp(w * 0.25 + 0.5, 0.0, 1.0), 3.0); // 归一 0..1 再锐化成稀疏亮丝（非均匀雾）
    // ②大尺度游走明暗：缓慢漂移的柔斑，只「调制」网纹强弱（不再是整片均匀加雾）。
    vec2 pc = vec2(0.5 + 0.3 * cos(time * 0.05), 0.5 + 0.25 * sin(time * 0.07));
    float pool = 1.0 - smoothstep(0.2, 0.75, distance(uv, pc));
    // ③涟漪坡面朝月动态增辉：有涟漪处网纹更亮（活水感），平水≈0。
    float slope = max(0.0, dot(grad, normalize(vec2(-0.6, 1.0)))) * 5.0;
    return web * (0.45 + 0.55 * pool) + slope;
  }

  // K10：程序化值噪声塘底（fract/sin 哈希 + smoothstep 双线性插值，两 octave 成有机沙纹/细石）。返回 0..1 暗纹强弱，
  // main 乘极小冷暗 RGB（不压亮，不破"水下不压黑"）；静止(不随 uTime/uZoomAmount)→ 动水面在其上产生视差=K10 纵深核心。
  float k10hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float k10noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(k10hash(i), k10hash(i + vec2(1.0, 0.0)), f.x), mix(k10hash(i + vec2(0.0, 1.0)), k10hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float pondFloorTex(vec2 uv) {
    vec2 p = uv * vec2(uViewport.x / max(1.0, uViewport.y), 1.0); // 宽高比校正 → 纹理近各向同性、不被宽屏拉长
    float n = k10noise(p * 9.0) * 0.6 + k10noise(p * 22.0) * 0.4; // 两 octave：大块沙纹 + 细石点
    return smoothstep(0.35, 0.85, n);                            // 收成稀疏暗纹（非均匀雾），留大片纯黑 = 高级感
  }

  // K11：月光倒影 mask（0..1）——一道大柔竖向冷白光华，偏左侧避球密集中区。muv=已随 K6 缩放的采样 UV（缩放参照）；
  // +grad 沿涟漪坡度把光带扭碎(展示波纹)；内嵌低频游走条纹 = 月华碎成的粼光（静水也活）。
  float moonReflectTex(vec2 muv, vec2 grad, float time) {
    vec2 q = muv + grad * 28.0;                       // 被高度梯度扭动 → 倒影随涟漪碎裂（梯度已含 edgeWin，平水≈不扭）
    float band = exp(-pow((q.x - 0.32) * 4.2, 2.0));  // 竖向高斯柔光带，中心偏左 0.32（一侧、不压中央的球）
    float vert = smoothstep(0.05, 0.45, q.y) * (1.0 - smoothstep(0.7, 1.05, q.y)); // 纵向柔窗：下半为主、顶端渐隐
    float shimmer = 0.6 + 0.4 * sin(q.y * 26.0 - time * 0.7 + sin(q.x * 9.0)); // 低频粼光条纹随时间游走 → 静水也活
    return band * vert * clamp(shimmer, 0.0, 1.0);
  }

  void main() {
    // K6：按水位绕中心缩放「高度场采样 UV」(只缩水层、球不动)。zoom=1+(水位−0.5)·uZoomAmount：高→收缩放大溢出/低→外撑缩小露更多，
    // 进行中涟漪也随之缩。OFF(uZoomAmount=0)：hUv=vUv、edgeWin=1 → 下面采样/梯度与现状逐字一致。
    vec2 hUv = vUv;
    if (uZoomAmount > 0.0) {
      float zoom = 1.0 + (uWaterLevel - 0.5) * uZoomAmount;
      hUv = (vUv - 0.5) / max(0.001, zoom) + 0.5;        // 绕中心缩放采样
      // 缩小(zoom<1)越界 [0,1]：镜像平铺(mirror) → 涟漪无缝延续，无真空区、无边界墙线/回弹硬边
      // （旧 clamp+平滑窗留"无涟漪真空区 + 边缘回弹线"；mirror C0 连续、弃用之）。
      hUv = 1.0 - abs(mod(hUv, 2.0) - 1.0);
    }
    // 梯度步长恒用 uDelta（场内自然梯度）→ 缩放只改涟漪位置/大小、不改亮度（曾用 uDelta/zoom 致降水位全屏变亮，弃用）。
    float h  = texture2D(uHeight, hUv).r;
    float hx = texture2D(uHeight, hUv + vec2(uDelta.x, 0.0)).r;
    float hy = texture2D(uHeight, hUv + vec2(0.0, uDelta.y)).r;
    vec2 grad = vec2(hx - h, hy - h); // 旧 -normalize 法线满幅位移→麻点，弃用
    float gmag = length(grad);
    float above = computeAbove(vUv);
    float sub = 1.0 - above;
    // 月光均匀眷顾水上水下：高光/焦散/倒影本来 ×sub（只水域）→ 出水球完全没月光、入水"一下子变亮"。
    // 改 ×moonGate（出水也得 70% 月光、水下 100%）→ 过水线平滑、出水球也被月光照到。折射/投影仍用 sub。
    float moonGate = mix(0.7, 1.0, sub);
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
    // K4 空中球→水面"投影"软盘 mask（A 暗影 / B 挡月光 / C 反光晕 共用；含视差/温和软化/水光打碎）。
    float aMask = (uSphereShowing > 0.5 || uShadowOcclude > 0.5 || uShadowGlow > 0.5)
      ? computeShadowMask(vUv, grad, uShadowHeight) * sub : 0.0;
    // B 挡月光：夺球下方"月光高光+焦散"两项光（暗处无光可夺→只在有光处显；验收需同开 K5 或划水产高光，否则看不出）。
    float occ = uShadowOcclude > 0.5 ? aMask * clamp(uShadowStrength * 3.0, 0.0, 1.0) : 0.0;
    vec4 scene = texture2D(uScene, sampleUv);
    vec3 col = scene.rgb + vec3(spec * uSpec * moonGate * moonMod * (1.0 - occ)); // 月光高光（均匀眷顾水上水下）被"挡月光"夺
    // A 暗影：冷向减光（多减暖留冷、影偏蓝灰不死黑；暗塘上弱、亮处显）
    if (uSphereShowing > 0.5) col = max(col - aMask * uShadowStrength * vec3(1.1, 1.0, 0.82), 0.0);
    // C 反光晕：加冷光（暗塘上加光比减光更显，像球的光落在下方水面）
    if (uShadowGlow > 0.5) col += aMask * uShadowStrength * 0.6 * vec3(0.55, 0.72, 0.95);
    // D 接触影：g=0 紧贴球的小柔影（无视差、不随高度涨），冷向减光
    if (uShadowContact > 0.5) col = max(col - computeShadowMask(vUv, grad, 0.0) * sub * uShadowStrength * vec3(1.1, 1.0, 0.82), 0.0);
    // K5：月光焦散冷白光照（uCaustics<0.5 跳过=现状）。×sub 只水域、只加亮不压暗(不破"水下不压黑")；×(1−occ) 被挡月光夺。
    if (uCaustics > 0.5) col += computeCaustics(vUv, grad, uTime) * uCausticsStrength * moonGate * (1.0 - occ) * vec3(0.55, 0.72, 0.95);
    // K10：可见塘底（<0.5 跳过=纯黑现状）。用「未缩 vUv + 涟漪折射 disp」采纹理 → 塘底坐标基不随 uZoomAmount 缩、只被涟漪折射 →
    // 动水面在静止塘底上产生视差(K10 纵深核心)。×sub 只水域、极淡冷暗增量(不压亮，不破"水下不压黑")。
    if (uPondFloor > 0.5) col += pondFloorTex(vUv + disp * sub) * uPondFloorStrength * sub * vec3(0.30, 0.45, 0.55);
    // K11：月光倒影（uMoonReflect<0.5 跳过=现状）。喂 hUv(已随 K6 缩放的采样 UV→倒影随水放缩) + grad(被涟漪扭碎展示波纹)；
    // ×sub 只水域、低不透明克制冷白(#e8f2ff)→ 偏左一侧不盖球，只加亮不压暗（不破"水下不压黑"）。
    if (uMoonReflect > 0.5) col += moonReflectTex(hUv, grad, uTime) * uMoonReflectStrength * moonGate * vec3(0.91, 0.95, 1.0);
    gl_FragColor = vec4(col, scene.a);
  }
`;
