import type { P9Lane } from '../registry';

export interface P9TuneDefinition {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}

const t = (key: string, label: string, min: number, max: number, step: number, initial: number): P9TuneDefinition => (
  { key, label, min, max, step, initial }
);

export const P9_FAMILY_META: Readonly<Record<P9Lane, readonly P9TuneDefinition[]>> = {
  eclipse: [
    t('attack', '攻击', 0.03, 0.8, 0.01, 0.12), t('release', '释放', 0.2, 2.5, 0.05, 0.9),
    t('stack', '叠加强度', 0.3, 2, 0.05, 1), t('ring', '白环幅度', 0.2, 2, 0.05, 1),
    t('halo', '光晕幅度', 0.2, 2, 0.05, 1), t('core', '黑核幅度', 0.2, 2, 0.05, 1),
  ],
  motes: [
    t('attack', '攻击', 0.05, 1, 0.01, 0.28), t('release', '释放', 0.2, 3, 0.05, 1.1),
    t('stack', '叠加强度', 0.3, 2, 0.05, 1), t('brightness', '亮度上限', 0.3, 2.5, 0.05, 1.4),
    t('motionMin', '运动随机最小', 0, 1, 0.05, 0.2), t('motionMax', '运动随机最大', 0.2, 2.5, 0.05, 1.2),
    t('scaleMin', '尺度随机最小', 0.4, 1, 0.05, 0.7), t('scaleMax', '尺度随机最大', 1, 2.5, 0.05, 1.5),
  ],
  petals: [
    t('attack', '攻击', 0.1, 2, 0.05, 0.65), t('release', '释放', 0.3, 4, 0.05, 1.6),
    t('stack', '叠加强度', 0.3, 2, 0.05, 1), t('boundary', '边界阻尼', 0.2, 2, 0.05, 1),
  ],
  water: [
    t('attack', '攻击', 0.03, 0.8, 0.01, 0.12), t('release', '释放', 0.2, 3, 0.05, 0.9),
    t('stack', '叠加强度', 0.3, 2, 0.05, 1), t('waveStrength', '波前强度', 0.2, 2.5, 0.05, 1),
    t('causticGain', '焦散幅度', 0.2, 2.5, 0.05, 1),
  ],
  scene: [
    t('attack', '攻击', 0.05, 1, 0.01, 0.2), t('release', '释放', 0.3, 3, 0.05, 1.1),
    t('stack', '叠加强度', 0.3, 1.5, 0.05, 0.85), t('scatter', '方向离散', 0, 1.5, 0.05, 0.7),
    t('globalLimit', '全屏幅度上限', 0.3, 1, 0.05, 0.86),
  ],
};

export const P9_LANE_LABEL: Readonly<Record<P9Lane, string>> = {
  eclipse: '日食', motes: '微光', petals: '花瓣', water: '水面', scene: '场景',
};
