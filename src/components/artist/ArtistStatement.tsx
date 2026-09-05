type Props = {
  statement: string;
};

export default function ArtistStatement({ statement }: Props) {
  return (
    <section className="artist-statement" aria-labelledby="artist-statement-title">
      <p className="artist-page__folio">STATEMENT / DRAFT</p>
      <div className="artist-statement__body">
        <h2 id="artist-statement-title">关于声音相遇</h2>
        <p>{statement}</p>
      </div>
    </section>
  );
}
