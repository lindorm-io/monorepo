import type { ILogger } from "@lindorm/logger";
import { randomUUID } from "@lindorm/random";
import type { IrisEnvelope } from "../types/iris-envelope";
import type { IDeadLetterStore } from "../../interfaces/IrisDeadLetterStore";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../types/dead-letter";
import type { DeadLetterManagerOptions } from "./types";

export class DeadLetterManager {
  private readonly store: IDeadLetterStore;
  private readonly logger: ILogger;

  public constructor(options: DeadLetterManagerOptions) {
    this.store = options.store;
    this.logger = options.logger.child(["DeadLetterManager"]);
  }

  public async send(
    envelope: IrisEnvelope,
    topic: string,
    error: Error,
  ): Promise<string> {
    const id = randomUUID();

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

  public async list(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    return this.store.list(options);
  }

  public async get(id: string): Promise<DeadLetterEntry | null> {
    return this.store.get(id);
  }

  public async remove(id: string): Promise<boolean> {
    return this.store.remove(id);
  }

  public async purge(options?: DeadLetterFilterOptions): Promise<number> {
    const count = await this.store.purge(options);

    this.logger.info("Dead letter purged", {
      count,
      topic: options?.topic ?? "all",
    });

    return count;
  }

  public async count(options?: DeadLetterFilterOptions): Promise<number> {
    return this.store.count(options);
  }

  public async close(): Promise<void> {
    await this.store.close();
  }
}
