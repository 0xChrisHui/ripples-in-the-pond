'use client';
import ArtistPortrait from './ArtistPortrait';
import ArtistStatement from './ArtistStatement';
import { artistContent } from '../../content/artist';
import '@/app/artist/artist.css';

/** 与私人档案一样保持前景实例；图片和文字提前就绪，点击只换层。 */
export default function ArtistPondPage() {
  return <main className="artist-page artist-page--pond" data-p11-theme="pond"
    data-pond-focus-entry="artist" tabIndex={-1}>
    <div className="artist-page__shell">
      <ArtistPortrait content={artistContent} />
      <ArtistStatement title={artistContent.projectTitle} paragraphs={artistContent.projectIntroduction} />
      <footer className="artist-page__footer"><span>YE YUHAN</span><span>RIPPLES IN THE POND</span></footer>
    </div>
  </main>;
}
