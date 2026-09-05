import type { CSSProperties } from 'react';
import ProjectFacts from './ProjectFacts';

type Props = {
  description: string;
  published: number | null;
  totalMints: number | null;
  participants: number | null;
};

const steps = ['一次演奏', '永久资源', 'ScoreNFT', '可重放唱片'];

export default function Project108({ description, published, totalMints, participants }: Props) {
  const progress = published === null ? null : Math.min(100, Math.max(0, published / 1.08));
  const progressStyle = progress === null
    ? undefined
    : ({ '--artist-progress': `${progress}%` } as CSSProperties);

  return (
    <section className="project-108" aria-labelledby="project-108-title">
      <header className="project-108__header">
        <div>
          <p className="artist-page__folio">A LONG-TERM SCORE PRACTICE</p>
          <h2 id="project-108-title">108</h2>
        </div>
        <p>{description}</p>
      </header>

      <div className="project-108__index" style={progressStyle}>
        <div className="project-108__line" aria-hidden="true">
          {progress !== null && <span />}
        </div>
        <p>{published === null ? '完成度暂不可用' : `${published} / 108 已发布`}</p>
      </div>

      <ol className="project-108__mechanism" aria-label="作品保存机制">
        {steps.map((step, index) => (
          <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>
        ))}
      </ol>

      <ProjectFacts published={published} totalMints={totalMints} participants={participants} />
    </section>
  );
}
