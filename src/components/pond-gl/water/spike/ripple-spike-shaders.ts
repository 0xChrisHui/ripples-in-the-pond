/**
 * H1 spike — RTT 验证用 shader（隔离实验，不进生产水面）。
 *
 * Step 1 只验"render-to-texture round-trip + 扭曲"：
 *  - contentFrag：在离屏 FBO 里画一张有结构的测试图（网格 + 彩色圆），便于看清扭动
 *  - compositeSinFrag：全屏采样那张 FBO，按"假 sin"偏移 UV → 看到图在扭 = RTT 通了
 * Step 2 会把假 sin 换成真·ping-pong 高度场梯度（届时另起 sim shader）。
 */

/** 全屏裁剪空间 quad（gl_Position 直接用 position.xy，不依赖相机） */
export const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** 内容图案：网格 + 三个彩色圆（静态；动的扭曲来自合成 pass，最能体现"透镜"感） */
export const contentFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    vec2 g = abs(fract(uv * 12.0) - 0.5);
    float grid = smoothstep(0.46, 0.5, max(g.x, g.y));
    vec3 col = mix(vec3(0.04, 0.07, 0.10), vec3(0.20, 0.45, 0.55), grid);
    col += vec3(0.90, 0.30, 0.30) * smoothstep(0.12, 0.10, distance(uv, vec2(0.30, 0.35)));
    col += vec3(0.30, 0.80, 0.40) * smoothstep(0.10, 0.08, distance(uv, vec2(0.70, 0.55)));
    col += vec3(0.40, 0.50, 0.95) * smoothstep(0.14, 0.12, distance(uv, vec2(0.50, 0.75)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** 合成（Step 1 旧版）：采样内容 FBO + 假 sin 偏移 UV。Step 2 已换 compositeHeightFrag，留作对照。 */
export const compositeSinFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform float uTime;
  uniform float uAmp;
  void main() {
    vec2 off = vec2(
      sin(vUv.y * 24.0 + uTime * 1.6),
      cos(vUv.x * 20.0 + uTime * 1.3)
    ) * uAmp;
    gl_FragColor = texture2D(uScene, vUv + off);
  }
`;

/**
 * 单帧可注入的滴水上限（指针 + 拖球尾迹 + 穿越溅起 + 常驻微波合用一组槽）。
 * JS 侧据此分配 uDrops 数组长度，GLSL 侧当循环常量上限。
 */
export const MAX_DROPS = 12;

/**
 * Step 2 — ping-pong 高度场 sim（jquery.ripples 离散波动方程，逐行来自调研报告 §4 路径1）。
 * 数据纹理：.r=高度、.g=速度。读 uPrev、写新一帧。
 * H4：滴水从「单个 uMouse」改成「uDrops 数组」——一帧能同时注入指针 + 拖球尾迹 + 多颗穿越溅起，
 * 每滴 = (uv.x, uv.y, 半径, 强度)，逐滴叠"升余弦凸包"（与单滴公式一致）。
 */
export const simFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2  uDelta;     // (1/RES, 1/RES)
  uniform vec4  uDrops[${MAX_DROPS}]; // 每滴 (uv.x, uv.y, 半径, 强度)
  uniform int   uDropCount; // 本帧有效滴数（其余槽忽略）
  uniform float uDamping;   // 阻尼（参数板可调，0.995 起）
  uniform float uAspect;    // K1：屏幕宽高比 W/H，仅用于滴水注入的正圆距离度量（传播由屏上正方格保证）
  const float PI = 3.141592653589793;
  void main() {
    vec4 info = texture2D(uPrev, vUv);
    // K1(正式)：高度场已按屏幕宽高比建成「屏上正方格」(WaterDistort RES_X/RES_Y) →
    // 各向同性拉普拉斯在屏幕上天然就是正圆，撤回 K1+ 的 1/aspect² 各向异性补偿。
    float avg = (
      texture2D(uPrev, vUv - vec2(uDelta.x, 0.0)).r +
      texture2D(uPrev, vUv - vec2(0.0, uDelta.y)).r +
      texture2D(uPrev, vUv + vec2(uDelta.x, 0.0)).r +
      texture2D(uPrev, vUv + vec2(0.0, uDelta.y)).r) * 0.25;
    info.g += (avg - info.r) * 2.0;   // 速度 += (邻居均值 - 高度) * 2（离散拉普拉斯回复力）
    info.g *= uDamping;               // 阻尼（唯一能量损耗）
    info.r += info.g;                 // 高度 += 速度（半隐式欧拉）
    for (int i = 0; i < ${MAX_DROPS}; i++) {  // 多滴注入：升余弦凸包逐滴叠加
      if (i >= uDropCount) break;
      vec4 dp = uDrops[i];
      // 滴水仍按 UV(0–1) 定义，在宽屏上各向异性 → x 分量乘 uAspect 抵消横向拉伸 → 正圆。
      // （传播的正圆由 RES_X/RES_Y 的屏上正方格保证，此处只管滴水注入那一刻。）
      vec2 off = (dp.xy - vUv) * vec2(uAspect, 1.0);
      float d = max(0.0, 1.0 - length(off) / dp.z);
      info.r += (0.5 - 0.5 * cos(d * PI)) * dp.w;
    }
    gl_FragColor = info;
  }
`;

/**
 * Step 2 — 合成：高度场梯度重建法线 → 偏移内容 UV（真折射）+ 假月光高光。逐行来自调研报告 §4 路径1。
 */
export const compositeHeightFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;   // 内容 FBO
  uniform sampler2D uHeight;  // ping-pong 高度场
  uniform vec2  uDelta;       // (1/RES, 1/RES)
  uniform float uPerturb;     // 折射强度 ≈0.04
  uniform float uSpec;        // 高光强度（参数板可调）
  void main() {
    float h  = texture2D(uHeight, vUv).r;
    float hx = texture2D(uHeight, vUv + vec2(uDelta.x, 0.0)).r;
    float hy = texture2D(uHeight, vUv + vec2(0.0, uDelta.y)).r;
    // 折射位移 ∝ 梯度(坡度) + clamp：缓坡轻折、陡坡强折但不破（弃 normalize，避免满幅位移→麻点）
    vec2 grad = vec2(hx - h, hy - h);
    float gmag = length(grad);
    vec2 disp = clamp(-grad * uPerturb, -0.025, 0.025);
    vec2 dir = gmag > 1e-5 ? grad / gmag : vec2(0.0);
    float spec = pow(max(0.0, dot(-dir, normalize(vec2(-0.6, 1.0)))), 4.0) * smoothstep(0.0, 0.01, gmag);
    gl_FragColor = texture2D(uScene, vUv + disp) + vec4(vec3(spec * uSpec), 0.0);
  }
`;
