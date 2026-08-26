import {
  Color,
  type Camera,
  type OrthographicCamera,
  type Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
  Vector4,
} from 'three';
import type { QuadScene } from '../water-distort-setup';

export const BACKGROUND_LAYER = 0;
export const SPHERE_LAYER = 1;

interface RendererSnapshot {
  target: WebGLRenderTarget | null;
  clearColor: Color;
  clearAlpha: number;
  autoClear: boolean;
  layerMask: number;
  viewport: Vector4;
  scissor: Vector4;
  scissorTest: boolean;
}

function snapshotRenderer(gl: WebGLRenderer, camera: Camera): RendererSnapshot {
  return {
    target: gl.getRenderTarget(),
    clearColor: gl.getClearColor(new Color()),
    clearAlpha: gl.getClearAlpha(),
    autoClear: gl.autoClear,
    layerMask: camera.layers.mask,
    viewport: gl.getViewport(new Vector4()),
    scissor: gl.getScissor(new Vector4()),
    scissorTest: gl.getScissorTest(),
  };
}

function restoreRenderer(gl: WebGLRenderer, camera: Camera, saved: RendererSnapshot): void {
  gl.setRenderTarget(saved.target);
  gl.setClearColor(saved.clearColor, saved.clearAlpha);
  gl.autoClear = saved.autoClear;
  camera.layers.mask = saved.layerMask;
  gl.setViewport(saved.viewport);
  gl.setScissor(saved.scissor);
  gl.setScissorTest(saved.scissorTest);
}

function prepareTarget(gl: WebGLRenderer, target: WebGLRenderTarget, alpha: number): void {
  gl.setRenderTarget(target);
  // setRenderTarget 已从 target.viewport 写入物理像素 viewport；再次调用 renderer.setViewport
  // 会把 target.width/height 当逻辑像素再乘 DPR，导致离屏画面放大并裁掉右/下区域。
  gl.setClearColor(0x000000, alpha);
  gl.clear(true, false, false);
}

function renderScenePass(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  target: WebGLRenderTarget,
  layer: number,
  clearAlpha: number,
): void {
  prepareTarget(gl, target, clearAlpha);
  camera.layers.set(layer);
  gl.render(scene, camera);
}

/** 球材质的内部渲染模式：0=完整，1=水下 FBO，2=水上最终覆盖。 */
function setSphereWaterPass(scene: Scene, value: number): void {
  scene.traverse((object) => {
    const material = (object as { material?: { isShaderMaterial?: boolean; uniforms?: Record<string, { value: unknown }> } }).material;
    if (material?.isShaderMaterial && material.uniforms?.uWaterPass) {
      material.uniforms.uWaterPass.value = value;
    }
  });
}

export interface FrameTargets {
  background: WebGLRenderTarget;
  sphere: WebGLRenderTarget;
  sphereAbove: WebGLRenderTarget;
  heightRead: WebGLRenderTarget;
  heightWrite: WebGLRenderTarget;
}

export interface FramePasses {
  sim: QuadScene;
  composite: QuadScene;
  quadCamera: OrthographicCamera;
}

export interface FrameOptions {
  hasSpheres: boolean;
}

export function clearHeightTargets(gl: WebGLRenderer, targets: FrameTargets): void {
  const savedTarget = gl.getRenderTarget();
  const savedAutoClear = gl.autoClear;
  const savedClearColor = gl.getClearColor(new Color());
  const savedClearAlpha = gl.getClearAlpha();
  const savedViewport = gl.getViewport(new Vector4());
  const savedScissor = gl.getScissor(new Vector4());
  const savedScissorTest = gl.getScissorTest();
  try {
    gl.autoClear = false;
    prepareTarget(gl, targets.heightRead, 0);
    prepareTarget(gl, targets.heightWrite, 0);
  } finally {
    gl.setRenderTarget(savedTarget);
    gl.autoClear = savedAutoClear;
    gl.setClearColor(savedClearColor, savedClearAlpha);
    gl.setViewport(savedViewport);
    gl.setScissor(savedScissor);
    gl.setScissorTest(savedScissorTest);
  }
}

/** 执行一帧并在异常路径恢复 renderer/camera 全部状态。 */
export function renderFrame(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  targets: FrameTargets,
  passes: FramePasses,
  options: FrameOptions,
): void {
  const saved = snapshotRenderer(gl, camera);
  try {
    gl.autoClear = false;
    renderScenePass(gl, scene, camera, targets.background, BACKGROUND_LAYER, 1);
    if (options.hasSpheres) {
      setSphereWaterPass(scene, 1);
      renderScenePass(gl, scene, camera, targets.sphere, SPHERE_LAYER, 0);
      setSphereWaterPass(scene, 2);
      renderScenePass(gl, scene, camera, targets.sphereAbove, SPHERE_LAYER, 0);
    }

    passes.sim.mat.uniforms.uPrev.value = targets.heightRead.texture;
    prepareTarget(gl, targets.heightWrite, 0);
    gl.render(passes.sim.scene, passes.quadCamera);

    passes.composite.mat.uniforms.uBackgroundScene.value = targets.background.texture;
    passes.composite.mat.uniforms.uSphereScene.value = targets.sphere.texture;
    passes.composite.mat.uniforms.uAboveSphereScene.value = targets.sphereAbove.texture;
    passes.composite.mat.uniforms.uHasSpheres.value = options.hasSpheres ? 1 : 0;
    passes.composite.mat.uniforms.uHeight.value = targets.heightWrite.texture;
    gl.setRenderTarget(null);
    gl.setViewport(saved.viewport);
    gl.setScissor(saved.scissor);
    gl.setScissorTest(saved.scissorTest);
    gl.render(passes.composite.scene, passes.quadCamera);
  } finally {
    setSphereWaterPass(scene, 0);
    restoreRenderer(gl, camera, saved);
  }
}
