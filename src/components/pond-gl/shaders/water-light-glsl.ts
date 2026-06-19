/**
 * 共享 pond-gl（/test1 等）水面「光照/遮罩」GLSL 片段（从 water-distort-shaders 抽出腾行数；注入同一 shader，引用其 uniform）。
 * 含：K4 投影 computeShadowMask / K5 焦散 computeCaustics / K11 倒影 moonReflectTex / 球几何遮罩 ballMask。
 * 以函数形式注入（接 maxSpheres 拼循环上限）→ 不与 water-distort-shaders 的 MAX_SPHERES 形成循环 import。
 * 注：与 pond-gl-test3 下的同名文件是**独立副本**（刻意不共享 → 改一边不影响另一边）。
 */
export function waterLightGlsl(maxSpheres: number): string {
  return /* glsl */ `
  // K4：空中球(air=depthZ−uWaterLevel>0)在下方水面投软影；水下/贴面球不投。月光=远光源(近平行)→按远光源建模：
  //  air 越大 → ①视差偏移越远(主高度线索) ②大小≈恒定(平行光无放大) ③透起伏水面/雾→温和变糊 ④环境补光→温和变淡。
  //  (旧近光源版"越高越大越淡的盘"=物理错，已纠正；辨析见 docs/JOURNAL.md 2026-06-18。)uShadowHeight=g 高度增益；grad=水面坡度。
  float computeShadowMask(vec2 uv, vec2 grad, float g) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    vec2 offDir = normalize(vec2(0.5, 1.0)); // 背光方向(右下，月光自左上)：影偏移方向
    float vh = max(1.0, uViewport.y);
    float shadow = 0.0;
    for (int i = 0; i < ${maxSpheres}; i++) {
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
      shadow = max(shadow, spot * (1.0 - 0.35 * t) * uSphereVis[i]); // ③温和变淡（环境补光）：高处 ×0.65；×vis 淡出球不投影
    }
    // 水光网纹打碎（亮处被光"打穿" → 水面感、平水也活），四种投影模式共用此 mask。
    float sAspect = uViewport.x / max(1.0, uViewport.y);
    vec2 wp = uv * vec2(8.0 * sAspect, 8.0);
    float lite = sin(wp.x + uTime * 0.5) + sin(wp.y * 0.9 - uTime * 0.4) + sin((wp.x + wp.y) * 0.6 + uTime * 0.6);
    return shadow * (1.0 - 0.5 * smoothstep(0.4, 2.2, lite));
  }

  // K5：月光焦散光照（参考 flower-water-ripples FSH 的 light/spec/band/pool，翻成夜塘月光冷白版）。
  // 返回标量"冷白增量"——main 里乘冷白 RGB 叠加（只加亮、不上色、不压暗 → 不破"水下不压黑"）。
  float computeCaustics(vec2 uv, vec2 grad, float time) {
    float aspect = uViewport.x / max(1.0, uViewport.y);
    vec2 p = uv * vec2(7.0 * aspect, 7.0);
    float t = time * 0.4;
    float w = sin(p.x + t) + sin(p.y - t * 0.9)
            + sin((p.x + p.y) * 0.7 + t * 1.1)
            + sin((p.x - p.y) * 0.6 - t * 0.7);
    float web = pow(clamp(w * 0.25 + 0.5, 0.0, 1.0), 3.0); // 归一 0..1 再锐化成稀疏亮丝
    vec2 pc = vec2(0.5 + 0.3 * cos(time * 0.05), 0.5 + 0.25 * sin(time * 0.07));
    float pool = 1.0 - smoothstep(0.2, 0.75, distance(uv, pc));
    float slope = max(0.0, dot(grad, normalize(vec2(-0.6, 1.0)))) * 5.0; // 涟漪坡面朝月增辉，平水≈0
    return web * (0.45 + 0.55 * pool) + slope;
  }

  // K11：月光倒影 mask（0..1）——一道大柔竖向冷白光华，偏左侧避球密集中区；+grad 沿涟漪坡度扭碎；内嵌低频游走粼光。
  float moonReflectTex(vec2 muv, vec2 grad, float time) {
    vec2 q = muv + grad * 28.0;
    float band = exp(-pow((q.x - 0.32) * 4.2, 2.0));  // 竖向高斯柔光带，中心偏左 0.32
    float vert = smoothstep(0.05, 0.45, q.y) * (1.0 - smoothstep(0.7, 1.05, q.y)); // 纵向柔窗
    float shimmer = 0.6 + 0.4 * sin(q.y * 26.0 - time * 0.7 + sin(q.x * 9.0)); // 粼光条纹随时间游走
    return band * vert * clamp(shimmer, 0.0, 1.0);
  }

  // 球几何遮罩：vec2(cover, aboveW)。cover=球覆盖(不论深浅, edge×vis)；aboveW=其中"出水"加权(×depthMask)。
  // → aboveW/cover = 该球像素的出水比例(0 水下 .. 1 水上)，用于在水上/水下衰减间插值。与 computeAbove 同 edge/depthMask 阈值。
  vec2 ballMask(vec2 uv) {
    vec2 px = vec2(uv.x, 1.0 - uv.y) * uViewport;
    float cover = 0.0;
    float aboveW = 0.0;
    for (int i = 0; i < ${maxSpheres}; i++) {
      if (i >= uSphereCount) break;
      vec4 s = uSpheres[i];
      float edge = (1.0 - smoothstep(s.z * 0.82, s.z, distance(px, s.xy))) * uSphereVis[i];
      float st = clamp((uWaterLevel - s.w + 0.02) / 0.12, 0.0, 1.0);
      float depthMask = 1.0 - st * st * (3.0 - 2.0 * st); // 1=出水, 0=水下
      cover = max(cover, edge);
      aboveW = max(aboveW, edge * depthMask);
    }
    return vec2(cover, aboveW);
  }
`;
}
