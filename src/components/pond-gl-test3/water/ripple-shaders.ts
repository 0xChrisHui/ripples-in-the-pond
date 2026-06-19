/**
 * G5 水波 shader — 程序化解析水面（纯 fragment shader，无离屏渲染/FBO/ping-pong）。
 *
 * 决策（2026-06-13）：原"useFrame 里手搓离屏 ping-pong 高度场"在用户环境跑不起来
 * （排除了 half-float / 动态数组索引 / frustumCulled，确认是 R3F 里手动离屏渲染管线本身的问题）。
 * 改为程序化：高度场 = 背景常驻微波（时间驱动）+ 若干解析扩散涟漪环，全在片元里算。
 * 法线由相邻采样差分得到 → 折射基调 + MOON_ANCHOR 月光 specular。
 */

export const fullscreenVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const waterFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform int uArtDir;     // 0 deep / 1 black
  uniform vec2 uMoonDir;   // MOON_ANCHOR 派生月光方向（GL 坐标）
  uniform float uRefract;  // 折射强度
  uniform float uMoon;     // 月光强度
  uniform vec4 uRipples[5]; // xy=uv 位置, z=起始时间(秒,-1=空), w=强度

  vec3 baseTone(vec2 uv) {
    if (uArtDir == 1) return vec3(0.0);
    float dd = distance(uv, vec2(0.5));
    float v = smoothstep(0.85, 0.08, dd);
    return mix(vec3(0.004, 0.012, 0.010), vec3(0.012, 0.040, 0.034), v);
  }

  // 单个解析涟漪：随 age 向外扩散的正弦环 × 时间衰减 × 距离衰减
  float ripple(vec4 rp, vec2 uv) {
    if (rp.z < 0.0) return 0.0;
    float age = uTime - rp.z;
    if (age < 0.0 || age > 3.0) return 0.0;
    float d = distance(uv, rp.xy);
    float env = exp(-age * 1.6) * exp(-d * 5.0) * smoothstep(0.0, 0.04, age);
    return sin(d * 55.0 - age * 9.0) * env * rp.w;
  }

  // 高度场 = 背景常驻微波（不交互也在动）+ 5 个解析涟漪（固定索引，无动态数组访问）
  float heightAt(vec2 uv) {
    float h = sin(uv.x * 16.0 + uTime * 0.8) * 0.10
            + sin(uv.y * 21.0 - uTime * 1.05) * 0.08;
    h += ripple(uRipples[0], uv);
    h += ripple(uRipples[1], uv);
    h += ripple(uRipples[2], uv);
    h += ripple(uRipples[3], uv);
    h += ripple(uRipples[4], uv);
    return h;
  }

  void main() {
    // 法线：相邻采样差分（程序化高度场，无纹理）
    float e = 0.0016;
    float hC = heightAt(vUv);
    float hX = heightAt(vUv + vec2(e, 0.0));
    float hY = heightAt(vUv + vec2(0.0, e));
    vec3 normal = normalize(vec3(hC - hX, hC - hY, e * 14.0));

    vec3 col = baseTone(vUv + normal.xy * uRefract);
    vec3 lightDir = normalize(vec3(uMoonDir, 0.6));
    float spec = pow(max(dot(normal, lightDir), 0.0), 30.0);
    col += vec3(0.55, 0.68, 0.82) * spec * uMoon; // 冷白月光

    gl_FragColor = vec4(col, 1.0);
  }
`;
