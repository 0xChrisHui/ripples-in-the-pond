import { hashStr, halton, fLayer, NUM_LAYERS, buildClusterAssignment, computeNodeAttrs, generateLinks,
  type GroupId, type SimNode, type SimLink } from '@/src/components/archipelago/sphere-config';
import type { Track } from '@/src/types/tracks';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import { createLayoutRandom, layoutUnit } from '@/src/features/home-pond/layout-seed';

// z = 基准深度（建点固定，painter 排序用）；displayZ = H5 每帧浮沉后的动态深度（消费方读它）。
// _dragLoose 对标 sphere-sim-setup.ts；_focusLerp = H5 播放球浮出焦点的缓动状态（见 sphere-motion）。
type GlSource = { track: Track; echo?: never } | { echo: FeaturedEcho; track?: never };
export type GlPhysNode = Omit<SimNode, 'track'> & GlSource & {
  z: number;
  _dragLoose?: boolean;
  displayZ?: number;
  _focusLerp?: number;
  _waveZ?: number; // /test3：球浮动「层级波动」的 effDepth 域深度偏移（sphere-motion 写、applyFloat 读）
  _gvx?: number;   // 涟漪推"滑行"速度（独立于 d3 velocityDecay，慢衰减→惯性收尾，见 gl-sim-waves stepSphereGlide）
  _gvy?: number;
  // P8-L 生命感逐球状态（各模块每帧写；flag 关时不写 → 读方用 ?? 中性值 = 现状）
  _shiftOff?: number; // L2-1 滚轮去同步：叠加到深度的每球偏移
  _lagShift?: number; // L2-1 每球私有缓动值（时滞差）
  _parGain?: number;  // L2-2 视差幅度增益（缺省视作 1）
  _parAng?: number;   // L2-2 视差方向偏转弧度（缺省视作 0）
  _shivX?: number;    // L2-4 偶发颤动屏幕位移 x
  _shivY?: number;    // L2-4 偶发颤动屏幕位移 y
  _excite?: number;   // L3-2 扰动激励值（边缘剧烈度）
  _lifeDim?: number;  // L5-1 透明度隐现系数（缺省视作 1）
  _visualDim?: number; // P8-L A3：SphereInstances 写入的整体可见度，水面效果只读它
  _presence?: number;  // 第36特殊圆隐现 0..1（special36-step 写；缺省视作 1）
  _jelVx?: number;    // L3-3 果冻感平滑速度 x
  _jelVy?: number;    // L3-3 果冻感平滑速度 y
};
/** 普通球和 Echo 共用属性计算，Echo 不参与普通球的聚落与连线种子。 */
export function createGlNode(
  n: GlSource & { id: string } & ReturnType<typeof computeNodeAttrs>, baseZ: number, dataVersion: string,
): GlPhysNode {
  const h = hashStr(n.id);
  const z = Math.max(0, Math.min(1, baseZ + ((h % 601) / 1000) - 0.3));
  const baseLayer = Math.max(1, Math.min(NUM_LAYERS, Math.round((1 - z) * (NUM_LAYERS - 1) + 1)));
  const unit = (key: string) => layoutUnit(dataVersion, n.groupId, n.id, key);
  const lw = {
    amp: 0.6 + unit('lw-amp') * 0.8,
    f1: 0.04 + unit('lw-f1') * 0.08,
    f2: 0.10 + unit('lw-f2') * 0.15,
    p1: unit('lw-p1') * 6.283,
    p2: unit('lw-p2') * 6.283,
  };
  // 第36特殊圆半径 ×2（碰撞/命中/日食都读 radius，同步变大）
  const radius = n.kSize * fLayer(baseLayer) * (n.echo ? 2 : 1);
  return { ...n, baseLayer, lw, radius, z };
}
/** tracksToShow → 仅普通节点 + 链接；#36 由独立的追加路径负责。 */
export function buildGlNodes(tracksToShow: Track[], groupId: GroupId, dataVersion = 'legacy'): {
  nodes: GlPhysNode[];
  links: SimLink<GlPhysNode>[];
  assignment: Map<string, number>;
} {
  const baseNodes: (GlSource & { id: string } & ReturnType<typeof computeNodeAttrs>)[] = tracksToShow.map((t) => ({
    id: t.id,
    track: t,
    ...computeNodeAttrs(t, groupId),
  }));
  const nodeIds = baseNodes.map((n) => n.id);
  const { assignment, clusterCount } = buildClusterAssignment(
    nodeIds, createLayoutRandom(dataVersion, groupId, 'clusters', ...nodeIds),
  );
  // baseLayer 由 z 派生（与 use-sphere-z.ts 同公式），z 用于 painter 排序
  const clusterZ = Array.from({ length: clusterCount }, (_, i) => halton(i + 1, 5));
  const nodes: GlPhysNode[] = baseNodes.map((n) => {
    const baseZ = clusterZ[assignment.get(n.id) ?? 0] ?? 0.5;
    return createGlNode(n, baseZ, dataVersion);
  });
  // 远先画：z 升序（与 use-sphere-z sortedNodes 同序）→ instance index = 绘制顺序
  nodes.sort((a, b) => a.z - b.z);
  const links = generateLinks(nodes, assignment, createLayoutRandom(dataVersion, groupId, 'links', ...nodeIds));
  return { nodes, links, assignment };
}
