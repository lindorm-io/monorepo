import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import Redis from "ioredis";
import { DelayedMessageWorkerOptions } from "../../types";

export class DelayedMessageWorker {
  private readonly client: Redis;
  private readonly logger: ILogger;

  private isRunning: boolean;
  private ref: NodeJS.Immediate | null;

  public constructor(options: DelayedMessageWorkerOptions) {
    this.client = options.client;
    this.logger = options.logger.child(["DelayedMessageWorker"]);

    this.isRunning = false;
    this.ref = null;
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.debug("Starting delayed message polling");

    this.ref = setImmediate(this.poll.bind(this));
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.logger.debug("Stopping delayed message polling");

    clearImmediate(this.ref!);
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const now = Date.now();
      const keys = await this.client.keys("delayed:*");

      for (const key of keys) {
        const entries = await this.client.zrangebyscore(key, 0, now);

        for (const entry of entries) {
          await this.client.zrem(key, entry);

          try {
            const { message, streamKey } = JsonKit.parse(entry);
            const payload = JsonKit.stringify(message);

            const [sec, usec] = await this.client.time();
            const id = `${sec}${usec.toString().padStart(6, "0")}`;
            const redisId = await this.client.xadd(streamKey, id, "message", payload);

            this.logger.debug("Delivered delayed message", { streamKey, redisId });
          } catch (err: any) {
            this.logger.error("Failed to parse or deliver delayed message", err);
          }
        }
      }
    } catch (err: any) {
      this.logger.error("Polling error in RedisDelayedMessageWorker", err);
    } finally {
      setTimeout(this.poll.bind(this), 50);
    }
  }
}
