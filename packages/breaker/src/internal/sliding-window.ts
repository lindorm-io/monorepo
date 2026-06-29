export class SlidingWindow {
  private readonly timestamps: Array<number> = [];
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  record = (now: number = Date.now()): void => {
    this.timestamps.push(now);
    this.prune(now);
  };

  count = (now: number = Date.now()): number => {
    this.prune(now);
    return this.timestamps.length;
  };

  reset = (): void => {
    this.timestamps.length = 0;
  };

  private prune = (now: number): void => {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  };
}
