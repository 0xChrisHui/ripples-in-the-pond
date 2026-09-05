type Props = {
  published: number | null;
  totalMints: number | null;
  participants: number | null;
};

type Fact = {
  label: string;
  value: number | null;
  suffix?: string;
};

export default function ProjectFacts({ published, totalMints, participants }: Props) {
  const facts: Fact[] = [
    { label: '已发布作品', value: published, suffix: ' / 108' },
    { label: '作品铸造总数', value: totalMints },
    { label: '参与者', value: participants },
  ];

  return (
    <dl className="project-facts" aria-label="108 项目实时数据">
      {facts.map((fact, index) => (
        <div key={fact.label} className="project-facts__item">
          <dt><span>{String(index + 1).padStart(2, '0')}</span>{fact.label}</dt>
          <dd>
            {fact.value === null ? (
              <><strong>—</strong><small>数据暂不可用</small></>
            ) : (
              <strong>{fact.value}{fact.suffix}</strong>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
