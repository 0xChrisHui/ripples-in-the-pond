import Link from 'next/link';
import './artist.css';

export default function ArtistLoading() {
  return (
    <main className="artist-page artist-loading" data-p11-theme="archive" aria-busy="true">
      <div className="artist-page__shell">
        <nav className="artist-page__nav" aria-label="页面导航">
          <Link href="/">Ripples in the Pond</Link>
          <span>ARTIST / 001</span>
        </nav>
        <section className="artist-portrait">
          <div className="artist-portrait__name">
            <p className="artist-page__folio">ARTIST PORTRAIT</p>
            <h1>艺术家</h1>
          </div>
          <div className="artist-portrait__copy">
            <span className="artist-loading__line artist-loading__eyebrow" />
            <span className="artist-loading__line artist-loading__lead" />
            <span className="artist-loading__line artist-loading__body" />
            <span className="artist-loading__line artist-loading__body artist-loading__body--short" />
          </div>
        </section>
        <div className="artist-page__waterline" aria-hidden="true"><span /></div>
        <section className="artist-statement">
          <span className="artist-loading__line artist-loading__eyebrow" />
          <div className="artist-statement__body">
            <span className="artist-loading__line artist-loading__lead" />
            <span className="artist-loading__line artist-loading__block" />
          </div>
        </section>
        <p className="p11-visually-hidden">正在读取艺术家页面</p>
      </div>
    </main>
  );
}
