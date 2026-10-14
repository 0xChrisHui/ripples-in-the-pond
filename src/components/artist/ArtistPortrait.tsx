import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ArtistContent } from '@/src/content/artist';

type Props = {
  content: ArtistContent;
};

export default function ArtistPortrait({ content }: Props) {
  const t = useTranslations('artist');
  return (
    <section className="artist-portrait" aria-labelledby="artist-name">
      <figure className="artist-portrait__figure">
        <Image
          className="artist-portrait__image"
          src={content.portrait.src}
          alt={content.portrait.alt}
          width={1080}
          height={1080}
          sizes="(min-width: 1200px) 480px, (min-width: 768px) 58vw, 100vw"
          priority
        />
      </figure>
      <div className="artist-portrait__copy">
        <div className="artist-portrait__heading">
          <p className="artist-page__folio">{t('folio')}</p>
          <h1 id="artist-name">{content.displayName}</h1>
        </div>
        <div className="artist-portrait__text">
          {content.introduction.map((paragraph, index) => (
            <p key={paragraph} className={index === 0 ? 'artist-portrait__lead' : undefined}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
