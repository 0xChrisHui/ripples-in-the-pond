import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '叶禹含 — Ripples in the Pond',
  description: '音乐人、表演者与跨媒介创作者叶禹含，以及 Ripples in the Pond 项目介绍。',
};

export default function ArtistPage() {
  return <div data-pond-artist-route="true" />;
}
