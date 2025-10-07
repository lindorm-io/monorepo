import { ILogger } from "@lindorm/logger";
import { IKafkaDelayService, IKafkaDelayStore } from "../../interfaces";
import {
  KafkaDelayOptions,
  KafkaDelayPollCallback,
  KafkaDelayServiceOptions,
} from "../../types";
import { DelayMongo } from "./DelayMongo";
import { DelayPostgres } from "./DelayPostgres";
import { DelayRedis } from "./DelayRedis";
import { DelaySqlite } from "./DelaySqlite";

export class KafkaDelayService implements IKafkaDelayService {
  private readonly db: IKafkaDelayStore | undefined;
  private readonly logger: ILogger;
  private readonly polls: Map<string, NodeJS.Timeout>;

  public constructor(options: KafkaDelayServiceOptions) {
    this.logger = options.logger.child(["KafkaDelayService"]);

    this.polls = new Map();

    if (options.custom) {
      this.db = options.custom;
    } else if (options.mongo) {
      this.db = new DelayMongo(options.mongo);
    } else if (options.postgres) {
      this.db = new DelayPostgres(options.postgres);
    } else if (options.redis) {
      this.db = new DelayRedis(options.redis);
    } else if (options.sqlite) {
      this.db = new DelaySqlite(options.sqlite);
    } else {
      this.logger.warn(
        "No database configured for KafkaDelayService, delayed messages will not be stored or processed.",
      );
    }
  }

  // public

  public async delay(options: KafkaDelayOptions): Promise<void> {
    if (!this.db) {
      this.logger.error("No database configured for delayed messages");
      return;
    }

    this.logger.debug("Adding delayed message", {
      topic: options.topic,
      delay: options.delay,
    });

    await this.db.add(options);
  }

  public async poll(topic: string, callback: KafkaDelayPollCallback): Promise<void> {
    if (this.polls.has(topic)) return;

    await this.scheduleNextPoll(topic, callback);
  }

  public async stop(topic: string): Promise<void> {
    const timeout = this.polls.get(topic);

    if (timeout) {
      clearTimeout(timeout);

      this.polls.delete(topic);
    }
  }

  public async disconnect(): Promise<void> {
    for (const timeout of this.polls.values()) {
      clearTimeout(timeout);
    }

    this.polls.clear();
  }

  // private

  private async scheduleNextPoll(
    topic: string,
    callback: KafkaDelayPollCallback,
  ): Promise<void> {
    if (!this.db) {
      this.logger.error("No database configured for delayed messages");
      return;
    }

    const envelopes = await this.db.get(topic);

    this.logger.debug("Polling delayed messages", {
      topic,
      count: envelopes.length,
      envelopes,
    });

    for (const envelope of envelopes) {
      try {
        await callback(envelope);
        await this.db.ack(envelope.id);
      } catch (err) {
        console.error(
          `[KafkaDelayService] Failed to process envelope ${envelope.id}:`,
          err,
        );
      }
    }

    const timeout = setTimeout(() => this.scheduleNextPoll(topic, callback), 100);

    this.polls.set(topic, timeout);
  }
}
