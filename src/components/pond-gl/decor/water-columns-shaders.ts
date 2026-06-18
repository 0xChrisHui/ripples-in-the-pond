/**
 * K12 — 水位标尺柱 shader（礁石 / 水晶簇）。
 *
 * 范式同 FloatingMotes/WaterPlants：NDC 裁剪空间 billboard，不经相机（gl_Position 直接写裁剪坐标），
 * glSpheres 开/关都稳。柱子**钉死**——几何静态、不随 K6 缩放、不漂；只有"水线"随 getWaterLevel 在
 * 柱身上下移动（uWaterLevel uniform 驱动）。挂进 PondGL <Canvas> → 进 WaterDistort realScene →
 * 被合成 pass 折射，没入段随波轻扭（"在水里被水扭"）。
 *
 * 几何：每根柱 = 一个 instance 的竖直 quad。instanceMatrix 把单位 quad（局部 [-0.5,0.5]²）摆到
 * 柱身位置/宽高（含 aspect 校正，免宽屏拉胖）。aBase = 柱根钉死的 NDC 位置（用于一点透视径向外斜）。
 * aMeta = (高度, 半宽, 风格 kind: 0=石/1=晶)，传片元做风格 + 水线深度映射。
 *
 * 一点透视（消失点 = 画面中心 = NDC 原点 = K6 同心）：柱根 B 钉固定；顶部按 normalize(B)·|B|·uPersp·uv.y
 * 径向**外斜** → 中心柱≈纯俯视（|B|≈0 几乎不斜）、边缘柱斜出露身（露出更长水线段）。uPersp=滑块，
 * 0=纯俯视（轻为主，免和俯视的平球违和）。x 方向斜量用 1/aspect 校正，免宽屏横向斜过头。
 */

// 柱身深度域（贯穿水位范围）：根恒没入、梢恒出水 → 水位 0→1 时水线必扫过柱身（标尺）。
// 与 water-level 的 z 语义同源：current(水位)∈[0,1] 越大水越高；z 越小越深。
export const COL_Z_BASE = -0.2; // 柱根 z（恒 < 0 → 任意水位下都没入）
export const COL_Z_TOP = 1.2;   // 柱梢 z（恒 > 1 → 任意水位下都出水）

/**
 * 顶点：instanceMatrix 已把单位 quad 摆成柱身（NDC 位置 + 宽高 + aspect 校正）。
 * 在裁剪空间叠一点透视径向外斜：仅顶端（uv.y 大）按 aBase 方向外移 → billboard 整体微"斜出"。
 * vUv.y: 0=柱根/深、1=柱梢/高 → 片元据此算水线与深度。
 */
export const columnsVertex = /* glsl */ `
  uniform float uPersp;
  uniform float uAspect;
  attribute vec2 aBase;   // 柱根钉死的 NDC 位置（透视消失点 = 原点 → 用它做径向方向）
  attribute vec3 aMeta;   // (柱高 NDC, 半宽 NDC, kind: 0=石/1=晶)
  varying vec2 vUv;
  varying float vKind;
  void main() {
    vUv = uv;
    vKind = aMeta.z;
    // instanceMatrix：单位 quad → 该柱的位置/宽高（含 aspect）。先取裁剪坐标。
    vec4 clip = instanceMatrix * vec4(position.xy, 0.0, 1.0);
    // 一点透视：顶端按柱根方向径向外斜（|B| 越大越斜 → 边缘柱斜出露身、中心柱近纯俯视）。
    // uv.y∈[0,1] 作斜量权重（根不动、梢全斜）；x 斜量用 1/aspect 校正免宽屏过头。
    vec2 dir = aBase * uPersp * uv.y;   // normalize(B)*|B| == B（即 B*uPersp*uv.y）
    clip.x += dir.x / max(0.0001, uAspect);
    clip.y += dir.y;
    gl_Position = vec4(clip.xy, 0.0, 1.0);
  }
`;

/**
 * 片元：石/晶两风格 + 水线。
 * 水线 waterlineUv = (uWaterLevel − z_base)/(z_top − z_base)，z_base/z_top 即柱身深度域端点。
 * 线上（vUv.y > waterlineUv）= 出水：清晰、受顶冷光（顶端更亮）。
 * 线下（vUv.y < waterlineUv）= 没入：压暗偏蓝、向根渐隐（深处更隐），但**留亮度地板不死黑**（红线）。
 * 水线一道**冷白湿痕**（窄高亮带）= 水位读数。
 * 石（kind=0）：暗岩 silhouette、冷暗、低透；晶（kind=1）：冷光半透、接月光、更亮更通透。
 * 两风格都受 uStoneOn/uCrystalOn 门控：对应开关关 → 该 kind 整柱 alpha=0（不渲染）。
 */
export const columnsFragment = /* glsl */ `
  precision mediump float;
  uniform float uWaterLevel;   // 当前水位 current ∈[0,1]
  uniform float uTime;
  uniform float uOpacity;      // 柱身最大不透明度（石晶共用）
  uniform float uStoneOn;      // 礁石开关（1/0）
  uniform float uCrystalOn;    // 水晶柱开关（1/0）
  uniform float uZBase;        // 柱根 z（= COL_Z_BASE）
  uniform float uZTop;         // 柱梢 z（= COL_Z_TOP）
  varying vec2 vUv;
  varying float vKind;

  void main() {
    bool isStone = vKind < 0.5;
    // 该 kind 是否开启；都关时这柱不该被挂载，这里再兜一层（关 → alpha 0）
    float kindOn = isStone ? uStoneOn : uCrystalOn;
    if (kindOn < 0.5) discard;

    // 柱身横截面：以 quad 中心竖线为轴，|x−0.5| 决定离轴距离 → 做柔边 silhouette（圆柱感）。
    float ax = abs(vUv.x - 0.5) * 2.0;        // 0=轴心 1=边
    // 竖向锥形：根略宽、梢略窄（礁石/晶簇上收），叠到边界柔化
    float taper = mix(1.0, 0.62, vUv.y);
    float body = smoothstep(1.0, 0.55, ax / max(0.0001, taper));
    if (body <= 0.001) discard;

    // 水线：柱身 uv.y → z = mix(zBase, zTop, uv.y)；水线处 z == 水位。
    float waterlineUv = clamp((uWaterLevel - uZBase) / max(0.0001, (uZTop - uZBase)), 0.0, 1.0);
    float aboveWater = step(waterlineUv, vUv.y);    // 1=出水 0=没入
    // 没入深度 0..1：水线处 0 → 柱根 1（越深越压暗渐隐，与 getSubmerge 同向：z 越小越深）
    float subDepth = clamp((waterlineUv - vUv.y) / max(0.0001, waterlineUv), 0.0, 1.0);

    vec3 col;
    float alpha;
    if (isStone) {
      // 礁石：暗岩冷调，竖向微噪让岩面不呆板（廉价 sin 纹，不引噪声纹理）
      float grain = 0.5 + 0.5 * sin(vUv.y * 38.0 + ax * 7.0);
      vec3 rock = mix(vec3(0.05, 0.075, 0.085), vec3(0.11, 0.145, 0.16), grain);
      // 顶冷光：出水段顶端受月光提一点冷白（仅线上）
      float topLight = aboveWater * smoothstep(waterlineUv, 1.0, vUv.y) * 0.35;
      rock += vec3(0.10, 0.14, 0.18) * topLight;
      col = rock;
      alpha = body * uOpacity;
    } else {
      // 水晶柱：冷光半透，内部一道缓慢游走的高光带（接月光、通透）
      float core = smoothstep(1.0, 0.0, ax);                 // 轴心更亮
      float glow = 0.5 + 0.5 * sin(vUv.y * 9.0 - uTime * 0.6 + ax * 3.0);
      vec3 crystal = mix(vec3(0.16, 0.27, 0.36), vec3(0.55, 0.74, 0.95), core * (0.4 + 0.6 * glow));
      float topLight = aboveWater * smoothstep(waterlineUv, 1.0, vUv.y) * 0.4;
      crystal += vec3(0.18, 0.26, 0.34) * topLight;
      col = crystal;
      alpha = body * uOpacity * mix(0.62, 0.9, core); // 半透：边缘更透、轴心略实
    }

    // 没入段：压暗偏蓝 + 向根渐隐；**留亮度地板**（×≥0.42）不死黑（红线：水下不压黑）。
    float submergeDim = mix(1.0, 0.42, subDepth) * (1.0 - aboveWater) + aboveWater;
    col *= submergeDim;
    col = mix(col, col * vec3(0.7, 0.85, 1.15), (1.0 - aboveWater) * 0.6); // 没入偏冷蓝
    // 没入向根 alpha 渐隐（深处更隐，但不到 0 → 仍可辨标尺柱身）
    alpha *= mix(1.0, 0.55, subDepth * (1.0 - aboveWater));

    // 水线一道冷白湿痕：vUv.y 邻近 waterlineUv 的窄高亮带 = 水位读数（核心标尺线）。
    float lineW = 0.018;
    float wet = smoothstep(lineW, 0.0, abs(vUv.y - waterlineUv)) * body;
    col = mix(col, vec3(0.78, 0.9, 1.0), wet * 0.85);
    alpha = max(alpha, wet * uOpacity);

    gl_FragColor = vec4(col, alpha);
  }
`;
