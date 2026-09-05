import type { ArtistContent } from '@/src/content/artist';

type Props = {
  content: ArtistContent;
};

/** 文字本身建立人物感；未批准的链接整区不渲染。 */
export default function ArtistPortrait({ content }: Props) {
  return (
    <section className="artist-portrait" aria-labelledby="artist-name">
      <div className="artist-portrait__name">
        <p className="artist-page__folio">ARTIST / PORTRAIT</p>
        <h1 id="artist-name">{content.displayName}</h1>
      </div>

      <div className="artist-portrait__copy">
        <p className="artist-page__draft">{content.contentStatus}</p>
        <p className="artist-portrait__identity">{content.identityLine}</p>
        <p className="artist-portrait__bio">{content.biography}</p>

        {content.publicLinks.length > 0 && (
          <nav className="artist-portrait__links" aria-label="艺术家公开链接">
            {content.publicLinks.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}<span aria-hidden="true"> ↗</span>
              </a>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}
