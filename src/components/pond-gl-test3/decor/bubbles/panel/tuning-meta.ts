import type { BubbleTuning } from '../bubble-tuning';

/** 控制台的每一行：分组、标签、范围。kind 缺省为滑块；bool 为开关；color 为取色器。 */
export interface Row { key: keyof BubbleTuning; label: string; min?: number; max?: number; step?: number; kind?: 'bool' | 'color' }
export interface Group { title: string; open?: boolean; rows: Row[] }

export const GROUPS: Group[] = [
  { title: '生成节奏', open: true, rows: [
    { key: 'keepFull', label: '保持满组数(调试用)', kind: 'bool' },
    { key: 'meanGroups', label: '同时组数·均值', min: 0.2, max: 4, step: 0.1 },
    { key: 'maxGroups', label: '同时组数·上限', min: 1, max: 4, step: 1 },
    { key: 'spread', label: '组数离散度(越大越不均匀)', min: 0.3, max: 1.6, step: 0.05 },
    { key: 'playingGroupsMult', label: '播放时组数倍率', min: 0, max: 1, step: 0.05 },
    { key: 'countMin', label: '每串最少个数', min: 1, max: 8, step: 1 },
    { key: 'countMax', label: '每串最多个数', min: 1, max: 8, step: 1 },
  ] },
  { title: '运动', rows: [
    { key: 'speed', label: '上升速度倍率', min: 0.2, max: 3, step: 0.05 },
    { key: 'riseMin', label: '上升时长·最短(秒)', min: 1, max: 20, step: 0.5 },
    { key: 'riseMax', label: '上升时长·最长(秒)', min: 1, max: 30, step: 0.5 },
    { key: 'driftFrac', label: '上升横向位移比例(圆圈约0.17)', min: 0, max: 0.6, step: 0.01 },
    { key: 'swayMax', label: '蛇行幅度(px，避让余量随之变化)', min: 2, max: 40, step: 0.5 },
  ] },
  { title: '外观·大小与亮度', open: true, rows: [
    { key: 'size', label: '整体大小倍率', min: 0.3, max: 4, step: 0.05 },
    { key: 'leadBig', label: '每组第一个泡最大(领头)', kind: 'bool' },
    { key: 'sizeSpeed', label: '大泡升得更快(0=无)', min: 0, max: 2, step: 0.05 },
    { key: 'birthSpread', label: '泡的横向出生偏移(px)', min: 0, max: 40, step: 1 },
    { key: 'radiusDeep', label: '深处半径(px)', min: 0.5, max: 10, step: 0.1 },
    { key: 'radiusSurface', label: '水面额外半径(px)', min: 0, max: 20, step: 0.1 },
    { key: 'opacity', label: '整体亮度', min: 0, max: 2, step: 0.01 },
    { key: 'colorHex', label: '颜色', kind: 'color' },
    { key: 'depthDim', label: '深处亮度比例', min: 0, max: 1, step: 0.01 },
  ] },
  { title: '避让球', rows: [
    { key: 'avoidSpawn', label: '生成时避让球', kind: 'bool' },
    { key: 'avoidFade', label: '靠近球时淡出', kind: 'bool' },
  ] },
  { title: '破水涟漪', rows: [
    { key: 'popEnabled', label: '破水出涟漪', kind: 'bool' },
    { key: 'popSwell', label: '破前放大比例', min: 0, max: 0.6, step: 0.01 },
    { key: 'popStrength', label: '涟漪强度', min: 0, max: 0.3, step: 0.005 },
  ] },
  { title: '手记·出现', open: true, rows: [
    { key: 'notesEnabled', label: '出手记', kind: 'bool' },
    { key: 'noteEveryMin', label: '每几串带一条·最少', min: 1, max: 10, step: 1 },
    { key: 'noteEveryMax', label: '每几串带一条·最多', min: 1, max: 12, step: 1 },
    { key: 'suppressPlaying', label: '播放时不出手记', kind: 'bool' },
  ] },
  { title: '手记·版式', rows: [
    { key: 'noteWidth', label: '文字宽度(px)', min: 160, max: 640, step: 10 },
    { key: 'noteFont', label: '字号(px)', min: 10, max: 28, step: 0.5 },
    { key: 'noteOpacity', label: '文字不透明度', min: 0.1, max: 1, step: 0.01 },
    { key: 'boxOpacity', label: '悬停框不透明度', min: 0, max: 1, step: 0.01 },
  ] },
  { title: '手记·时间', rows: [
    { key: 'fadeMs', label: '淡入淡出时长(ms)', min: 100, max: 3000, step: 50 },
    { key: 'baseStay', label: '基础停留(ms)', min: 500, max: 20000, step: 100 },
  ] },
];
