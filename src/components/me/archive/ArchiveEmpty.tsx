import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

/** 空态只说明真实下一步；动作由调用方传入，避免制造不存在的入口。 */
export default function ArchiveEmpty({
  eyebrow = 'ARCHIVE NOTE',
  title,
  description,
  action,
  compact = false,
}: Props) {
  return (
    <div className="archive-empty" data-compact={compact || undefined}>
      <p className="archive-empty__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="archive-empty__description">{description}</p>
      {action && <div className="archive-empty__action">{action}</div>}
    </div>
  );
}
