import { KoaContext } from "../types";

export class Metric {
  private readonly ctx: KoaContext;
  private readonly key: string;
  private readonly start: number;
  private readonly current: number;

  public constructor(ctx: KoaContext, key: string) {
    this.ctx = ctx;
    this.key = key;
    this.start = Date.now();
    this.current = ctx.metrics[key] || 0;
  }

  public get(): number {
    return Date.now() - this.start;
  }

  public end(): void {
    this.ctx.metrics[this.key] = this.current + this.get();
  }
}
