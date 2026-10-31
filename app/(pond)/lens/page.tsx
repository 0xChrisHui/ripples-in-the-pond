import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '详情 — Ripples in the Pond',
  description: '提灯照水：逐首查看 Ripples in the Pond 的原曲、链上凭证与收藏入口。',
};

/** 首页别名：场景由持久外壳提供，路由文件只占位（与首页一致）。 */
export default function LensPage() {
  return <div data-pond-home-route="true" data-pond-lens-route="true" aria-hidden="true" />;
}
