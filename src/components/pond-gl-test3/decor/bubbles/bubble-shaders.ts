/**
 * P20 气泡 shader：照 FloatingMotes 的范式——position 直接是 NDC、不经相机，柔边、无 discard、加色混合。
 * 外观：冷白柔边光环、中心近透明、小高光朝左上（MOON_ANCHOR 方向）；越深越软越淡。全部参数走 uniform（调参表）。
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
  uniform float uDepthDim;
  uniform float uRingR;
  uniform vec2 uRingSoft;   // x 深处 y 水面
  uniform float uRingStrength;
  uniform float uInner;
  uniform vec2 uGlint;      // x 深处强度 y 水面强度
  uniform vec3 uGlintPos;   // xy 偏移 z 大小
  varying float vAlpha;
  varying float vDepth;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float r = length(p);
    float soft = mix(uRingSoft.x, uRingSoft.y, vDepth);
    float ring = 1.0 - smoothstep(0.0, soft, abs(r - uRingR));
    float inner = uInner * (1.0 - smoothstep(0.0, uRingR, r));
    vec2 hp = p - uGlintPos.xy;
    float glint = exp(-dot(hp, hp) / uGlintPos.z) * mix(uGlint.x, uGlint.y, vDepth);
    float a = (ring * uRingStrength + inner + glint) * uOpacity * vAlpha * mix(uDepthDim, 1.0, vDepth);
    gl_FragColor = vec4(uColor, a);
  }
`;
