export type ServerTimingStage = 'auth' | 'db' | 'rpc' | 'arweave' | 'serialize';

type HeaderResponse = { headers: Headers };
type Clock = () => number;

const STAGE_ORDER: readonly ServerTimingStage[] = [
  'auth',
  'db',
  'rpc',
  'arweave',
  'serialize',
];

function duration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function format(value: number): string {
  return duration(value).toFixed(1);
}

/**
 * 只允许固定阶段名进入响应头，避免把用户、钱包或错误详情误写进浏览器性能数据。
 * 同名阶段会累加，适合一个 route 内存在多次数据库读取的情况。
 */
export class ServerTiming {
  private readonly startedAt: number;
  private readonly durations = new Map<ServerTimingStage, number>();

  constructor(private readonly now: Clock = () => performance.now()) {
    this.startedAt = now();
  }

  record(stage: ServerTimingStage, elapsedMs: number): void {
    const current = this.durations.get(stage) ?? 0;
    this.durations.set(stage, current + duration(elapsedMs));
  }

  async measure<T>(
    stage: ServerTimingStage,
    operation: () => PromiseLike<T> | T,
  ): Promise<T> {
    const startedAt = this.now();
    try {
      return await operation();
    } finally {
      this.record(stage, this.now() - startedAt);
    }
  }

  measureSync<T>(stage: ServerTimingStage, operation: () => T): T {
    const startedAt = this.now();
    try {
      return operation();
    } finally {
      this.record(stage, this.now() - startedAt);
    }
  }

  headerValue(): string {
    const metrics = STAGE_ORDER.flatMap((stage) => {
      const elapsedMs = this.durations.get(stage);
      return elapsedMs === undefined ? [] : [`${stage};dur=${format(elapsedMs)}`];
    });
    metrics.push(`total;dur=${format(this.now() - this.startedAt)}`);
    return metrics.join(', ');
  }

  apply<T extends HeaderResponse>(response: T): T {
    response.headers.set('Server-Timing', this.headerValue());
    return response;
  }

  response<T extends HeaderResponse>(createResponse: () => T): T {
    return this.apply(this.measureSync('serialize', createResponse));
  }
}
