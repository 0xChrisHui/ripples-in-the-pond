/**
 * G3 基调层 shader — 全屏裁剪空间平面输出"深色水体基调"。
 *
 * 为什么独立成文件：项目约定 shader 字符串单独拆（G5 水面 shader 同样会拆 water/）。
 * 为什么不加背景图：§3 用户愿景 6 — 纯黑背景看不见水，解法是"深色水体基调 + 月光高光"，
 * 让水靠扭曲内容 + 高光被看见；本 step 先把基调铺出来。
 *
 * uMode: 0 = deep（深蓝墨绿径向渐晕）/ 1 = black（纯黑）。
 */

// 顶点：直接把平面顶点当裁剪空间坐标用（planeGeometry args=[2,2] → xy ∈ [-1,1]），
// 绕过相机做全屏背景，与 G4 起的正交相机世界层互不干扰。
export const baseToneVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 片元：deep 档做中心微亮(~4%)→边缘近黑(~1%)的径向渐晕；black 档纯黑。
export const baseToneFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform int uMode;
  void main() {
    if (uMode == 1) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    float d = distance(vUv, vec2(0.5));
    float v = smoothstep(0.85, 0.08, d);                 // 中心 1 → 边缘 0
    vec3 edge = vec3(0.004, 0.012, 0.010);               // 边缘近黑（深墨绿）
    vec3 core = vec3(0.012, 0.040, 0.034);               // 中心微亮（深蓝墨绿）
    gl_FragColor = vec4(mix(edge, core, v), 1.0);
  }
`;
