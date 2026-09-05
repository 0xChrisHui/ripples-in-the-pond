import EditionStamp, { type EditionStatus } from './EditionStamp';

type Props = {
  edition: string | number;
  title: string;
  status: EditionStatus;
  date: string;
  dateTime?: string;
  href: string;
  actionLabel?: string;
  statusDetail?: string;
};

function editionLabel(edition: string | number): string {
  if (typeof edition === 'number') return `#${String(edition).padStart(3, '0')}`;
  return edition.startsWith('#') ? edition : `#${edition}`;
}

/** /me 与 /artist 共用的档案行；整行只保留一个明确主动作。 */
export default function ArchiveRow({
  edition,
  title,
  status,
  date,
  dateTime,
  href,
  actionLabel = '查看作品',
  statusDetail,
}: Props) {
  return (
    <article className="archive-row">
      <p className="archive-row__edition">{editionLabel(edition)}</p>
      <h3>{title}</h3>
      <EditionStamp status={status} detail={statusDetail} />
      <time dateTime={dateTime}>{date}</time>
      <a className="archive-row__action" href={href} aria-label={`${actionLabel}：${title}`}>
        <span>{actionLabel}</span>
        <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
