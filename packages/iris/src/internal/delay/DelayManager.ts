import type { ILogger } from "@lindorm/logger";
import { randomUUID } from "@lindorm/random";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { IDelayStore } from "../../interfaces/IrisDelayStore.js";
import type { DelayedEntry } from "../../types/delay.js";
import type { DelayManagerOptions } from "./types.js";

export class DelayManager {
  private readonly store: IDelayStore;
  private readonly logger: ILogger;
  private readonly pollIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private callback: ((entry: DelayedEntry) => Promise<void>) | null = null;
  private polling = false;

  public constructor(options: DelayManagerOptions) {
    this.store = options.store;
    this.logger = options.logger.child(["DelayManager"]);
    this.pollIntervalMs = options.pollIntervalMs ?? 100;
  }

  public async schedule(
    envelope: IrisEnvelope,
    topic: string,
    delayMs: number,
  ): Promise<string> {
    const id = randomUUID();
    const deliverAt = Date.now() + delayMs;

    await this.store.schedule({ id, envelope, topic, deliverAt });

    this.logger.debug("Scheduled delayed delivery", { id, topic, deliverAt });

    return id;
  }

  public async cancel(id: string): Promise<boolean> {
    return this.store.cancel(id);
  }

  public start(callback: (entry: DelayedEntry) => Promise<void>): void {
    if (this.timer) return;

    this.callback = callback;
    this.timer = setInterval(() => this.doPoll(), this.pollIntervalMs);
    this.timer.unref();
    this.logger.debug("Delay polling started", {
      pollIntervalMs: this.pollIntervalMs,
    });
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.callback = null;
    this.logger.debug("Delay polling stopped");
  }

  public async size(): Promise<number> {
    return this.store.size();
  }

  public async close(): Promise<void> {
    this.stop();
    await this.store.close();
  }

  private async doPoll(): Promise<void> {
    if (this.polling || !this.callback) return;

    this.polling = true;

    try {
      const entries = await this.store.poll(Date.now());

      for (const entry of entries) {
        try {
          await this.callback(entry);
        } catch (err) {
          this.logger.error("Failed to deliver delayed entry", {
            id: entry.id,
            topic: entry.topic,
            error: err,
          });
        }
      }
    } catch (err) {
      this.logger.error("Delay poll failed", { error: err });
    } finally {
      this.polling = false;
    }
  }
}
