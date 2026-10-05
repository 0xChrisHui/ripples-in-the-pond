/** 位于现有Canvas中的局部前景，只用DOM测得的像素位置，不改共享相机。 */
export const circleVertexShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vParams;
  varying vec2 vSeed;
  varying float vSubmerge;
  varying float vLifeDim;
  uniform vec2 uCircleCenter;
  uniform vec2 uCircleScale;
  uniform vec3 uCircleColor;
  uniform float uCircleVisible;
  void main() {
    vUv = uv; vColor = uCircleColor; vParams = vec4(1.0, 0.36, uCircleVisible, 0.0);
    vSeed = vec2(1.23, 0.0); vSubmerge = 0.0; vLifeDim = 1.0;
    gl_Position = vec4(uCircleCenter + position.xy * uCircleScale, 0.0, 1.0);
  }
`;
