import type { ILogger } from "@lindorm/logger";
import { randomId } from "@lindorm/random";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { IDeadLetterStore } from "../../interfaces/IrisDeadLetterStore.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../types/dead-letter.js";
import type { DeadLetterManagerOptions } from "./types.js";

export class DeadLetterManager {
  private readonly store: IDeadLetterStore;
  private readonly logger: ILogger;

  constructor(options: DeadLetterManagerOptions) {
    this.store = options.store;
    this.logger = options.logger.child(["DeadLetterManager"]);
  }

  async send(envelope: IrisEnvelope, topic: string, error: Error): Promise<string> {
    const id = randomId({ namespace: "dlq", length: 16 });

    const entry: DeadLetterEntry = {
      id,
      envelope,
      topic,
      error: error.message,
      errorStack: error.stack ?? null,
      attempt: envelope.attempt,
      timestamp: Date.now(),
    };

    await this.store.add(entry);

    this.logger.warn("Message sent to dead letter", {
      id,
      topic,
      error: error.message,
      attempt: envelope.attempt,
    });

    return id;
  }

  async list(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    return this.store.list(options);
  }

  async get(id: string): Promise<DeadLetterEntry | null> {
    return this.store.get(id);
  }

  async remove(id: string): Promise<boolean> {
    return this.store.remove(id);
  }

  async purge(options?: DeadLetterFilterOptions): Promise<number> {
    const count = await this.store.purge(options);

    this.logger.info("Dead letter purged", {
      count,
      topic: options?.topic ?? "all",
    });

    return count;
  }

  async count(options?: DeadLetterFilterOptions): Promise<number> {
    return this.store.count(options);
  }

  async close(): Promise<void> {
    await this.store.close();
  }
}
