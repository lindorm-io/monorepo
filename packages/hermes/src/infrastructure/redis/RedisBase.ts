import { ILogger } from "@lindorm/logger";
import { IRedisSource } from "@lindorm/redis";

export abstract class RedisBase {
  protected readonly source: IRedisSource;
  protected readonly logger: ILogger;
  protected promise: () => Promise<void>;

  protected constructor(source: IRedisSource, logger: ILogger) {
    this.source = source;
    this.logger = logger.child(["RedisBase", this.constructor.name]);

    this.promise = this.connect;
  }

  // protected

  protected async connect(): Promise<void> {
    await this.source.connect();
  }
}
