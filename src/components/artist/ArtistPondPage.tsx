'use client';
import ArtistPortrait from './ArtistPortrait';
import ArtistStatement from './ArtistStatement';
import { artistContent } from '../../content/artist';
import { useLocaleSwitch } from '../../i18n/LocaleProvider';
import { useEnglishContent } from '../../i18n/content/use-english-content';
import '@/app/artist/artist.css';

/** 与私人档案一样保持前景实例；图片和文字提前就绪，点击只换层。 */
export default function ArtistPondPage() {
  const { locale } = useLocaleSwitch();
  // 英文模式换英文内容（D2）；加载完成前保持中文，与首帧一致
  const content = useEnglishContent(locale)?.artist ?? artistContent;
  return <main className="artist-page artist-page--pond" data-p11-theme="pond"
    data-pond-focus-entry="artist" tabIndex={-1}>
    <div className="artist-page__shell">
      <ArtistPortrait content={content} />
      <ArtistStatement title={content.projectTitle} paragraphs={content.projectIntroduction} />
      <footer className="artist-page__footer"><span>YE YUHAN</span><span>RIPPLES IN THE POND</span></footer>
    </div>
  </main>;
}
