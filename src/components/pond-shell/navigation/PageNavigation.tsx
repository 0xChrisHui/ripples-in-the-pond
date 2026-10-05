'use client';
import PondHeader from '../../pond-gl-test3/overlay/PondHeader';
import { usePondTransition } from '../pond-transition';

/** 池塘内共用持久顶栏；独立作品页使用同一个组件和位置。 */
export default function PageNavigation() {
  const transition = usePondTransition();
  return transition ? null : <PondHeader />;
}
