type Props = {
  title: string;
  paragraphs: string[];
};

export default function ArtistStatement({ title, paragraphs }: Props) {
  return (
    <section className="artist-statement" aria-labelledby="artist-statement-title">
      <header className="artist-statement__heading">
        <p className="artist-page__folio">PROJECT / INTRODUCTION</p>
        <h2 id="artist-statement-title">{title}</h2>
      </header>
      <div className="artist-statement__text">
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </section>
  );
}
