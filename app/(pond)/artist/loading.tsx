import '@/app/artist/artist.css';

export default function ArtistLoading() {
  return (
    <main className="artist-page artist-page--pond artist-loading" data-p11-theme="pond" aria-busy="true">
      <div className="artist-page__shell">
        <section className="artist-portrait">
          <span className="artist-loading__line artist-loading__image" />
          <div className="artist-portrait__copy">
            <span className="artist-loading__line artist-loading__eyebrow" />
            <span className="artist-loading__line artist-loading__name" />
            <span className="artist-loading__line artist-loading__body" />
            <span className="artist-loading__line artist-loading__body artist-loading__body--short" />
          </div>
        </section>
        <section className="artist-statement">
          <div className="artist-statement__heading">
            <span className="artist-loading__line artist-loading__eyebrow" />
            <span className="artist-loading__line artist-loading__lead" />
          </div>
          <div className="artist-statement__text">
            <span className="artist-loading__line artist-loading__block" />
          </div>
        </section>
        <p className="p11-visually-hidden">正在读取艺术家页面</p>
      </div>
    </main>
  );
}
