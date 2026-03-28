export class SlidingWindow {
  private readonly timestamps: Array<number> = [];
  private readonly windowMs: number;

  public constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  public record = (now: number = Date.now()): void => {
    this.timestamps.push(now);
    this.prune(now);
  };

  public count = (now: number = Date.now()): number => {
    this.prune(now);
    return this.timestamps.length;
  };

  public reset = (): void => {
    this.timestamps.length = 0;
  };

  private prune = (now: number): void => {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  };
}
