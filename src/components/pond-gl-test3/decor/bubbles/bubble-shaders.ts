/**
 * P20 气泡 shader：照 FloatingMotes 的范式——position 直接是 NDC、不经相机，柔边、无 discard、加色混合。
 * 外观：冷白柔边光环、中心近透明、小高光朝左上（MOON_ANCHOR 方向）；越深越软越淡。
 */
export const bubbleVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aDepth;
  varying float vAlpha;
  varying float vDepth;
  void main() {
    vAlpha = aAlpha;
    vDepth = aDepth;
    gl_Position = vec4(position.xy, 0.0, 1.0);
    gl_PointSize = aSize;
  }
`;

export const bubbleFragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vDepth;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float r = length(p);
    float soft = mix(0.16, 0.05, vDepth);                 // 深处光环更软
    float ring = 1.0 - smoothstep(0.0, soft, abs(r - 0.3));
    float inner = 0.06 * (1.0 - smoothstep(0.0, 0.3, r)); // 中心近透明，只留极淡的体
    vec2 hp = p - vec2(-0.13, -0.13);                     // 高光朝左上
    float glint = exp(-dot(hp, hp) / 0.0016) * mix(0.25, 0.6, vDepth);
    float a = (ring * 0.55 + inner + glint) * uOpacity * vAlpha * mix(0.45, 1.0, vDepth);
    gl_FragColor = vec4(uColor, a);
  }
`;
