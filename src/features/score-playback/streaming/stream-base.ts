export interface ScoreBaseStream {
  prime(): void;
  start(offsetMs: number): Promise<void>;
  pause(): void;
  positionMs(): number;
  durationMs(): number;
  destroy(): void;
}

/** 底曲只信任发布 Gate 已逐字节验证的不可覆盖 Edge 路径；失败交回完整下载回退。 */
export class HtmlScoreBaseStream implements ScoreBaseStream {
  private readonly audio = new Audio();
  private primed: Promise<void> | null = null;
  private revision = 0;
  constructor(private readonly url: string, private readonly onFailure: () => void) {
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('error', this.onFailure);
  }
  prime(): void {
    if (this.primed) return;
    this.audio.src = this.url;
    this.audio.muted = true;
    this.primed = this.audio.play().then(() => undefined);
    this.primed.catch(() => undefined);
  }
  async start(offsetMs: number): Promise<void> {
    this.prime();
    const revision = this.revision;
    await this.primed;
    if (revision !== this.revision) throw new DOMException('播放请求已取消', 'AbortError');
    this.audio.currentTime = offsetMs / 1000;
    this.audio.muted = false;
    await this.audio.play();
    performance.mark('p15:streaming-base-started');
  }
  pause(): void { this.revision += 1; this.audio.pause(); this.primed = null; }
  positionMs(): number { return this.audio.currentTime * 1000; }
  durationMs(): number { return Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0; }
  destroy(): void {
    this.pause();
    this.audio.removeEventListener('error', this.onFailure);
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
