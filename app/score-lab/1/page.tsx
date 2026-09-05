import { notFound } from 'next/navigation';
import { getScoreEvents } from '@/src/data/score-events-source';
import { getScoreById } from '@/src/data/score-source';
import SingleSpherePond from './SingleSpherePond';
import './single-sphere.css';

export default async function SingleSpherePondPage() {
  const [score, events] = await Promise.all([
    getScoreById('1'),
    getScoreEvents('1'),
  ]);

  if (!score?.track) notFound();

  const eventError = !events
    ? '无法定位 Token #1 的永久事件，请重试或打开永久 Decoder。'
    : events.length === 0
      ? '永久事件暂时不可读，没有把故障伪装成 0 个事件。'
      : score.eventCount > 0 && score.eventCount !== events.length
        ? `事件镜像不完整：应有 ${score.eventCount} 条，当前读取 ${events.length} 条。`
        : undefined;

  return <SingleSpherePond score={score} events={events ?? []} eventError={eventError} />;
}
