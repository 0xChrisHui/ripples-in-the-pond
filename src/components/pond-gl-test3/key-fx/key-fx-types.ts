export type KeyFxFamily = 'pressure' | 'resonance' | 'shear' | 'motes' | 'capillary'
  | 'sink' | 'relay' | 'petals' | 'dew' | 'lift';

export interface KeyFxChannels {
  motes: number;
  water: number;
  halo: number;
  petals: number;
}

/** 一枚真实高度场注入：at 是相对起音秒数，偏移使用屏幕 UV。 */
export interface KeyFxRippleStage {
  at: number;
  dx: number;
  dy: number;
  radius: number;
  strength: number;
}

/** 五个声音家族只描述作用力，不携带独立图形或颜色。 */
export interface KeyFxBehavior {
  family: KeyFxFamily;
  duration: number;
  mergeWindow: number;
  fieldRadius: number;
  channels: KeyFxChannels;
  ripples: readonly KeyFxRippleStage[];
}
