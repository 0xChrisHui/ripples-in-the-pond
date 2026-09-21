import type { Metadata } from 'next';
import Link from 'next/link';
import ArtistPortrait from '@/src/components/artist/ArtistPortrait';
import ArtistStatement from '@/src/components/artist/ArtistStatement';
import { artistContent } from '@/src/content/artist';
import './artist.css';

export const metadata: Metadata = {
  title: '叶禹含 — Ripples in the Pond',
  description: '音乐人、表演者与跨媒介创作者叶禹含，以及 Ripples in the Pond 项目介绍。',
};

export default function ArtistPage() {
  return (
    <main className="artist-page" data-p11-theme="archive">
      <div className="artist-page__shell">
        <nav className="artist-page__nav" aria-label="页面导航">
          <Link href="/">Ripples in the Pond</Link>
          <span><span className="artist-page__nav-prefix">ARTIST / </span>叶禹含</span>
        </nav>
        <ArtistPortrait content={artistContent} />
        <ArtistStatement
          title={artistContent.projectTitle}
          paragraphs={artistContent.projectIntroduction}
        />
        <footer className="artist-page__footer">
          <span>YE YUHAN</span><span>RIPPLES IN THE POND</span>
        </footer>
      </div>
    </main>
  );
}
