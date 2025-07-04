import { ILogger } from "@lindorm/logger";
import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { ChecksumError } from "../errors";
import { IChecksumStore, IHermesChecksumStore } from "../interfaces";
import { HermesEvent } from "../messages";
import { HermesChecksumStoreOptions } from "../types";
import { MongoChecksumStore } from "./mongo";
import { PostgresChecksumStore } from "./postgres";

export class ChecksumStore implements IHermesChecksumStore {
  private readonly store: IChecksumStore;
  private readonly logger: ILogger;

  public constructor(options: HermesChecksumStoreOptions) {
    this.logger = options.logger.child(["ChecksumStore"]);

    if (options.custom) {
      this.store = options.custom;
    } else if (options.mongo?.name === "MongoSource") {
      this.store = new MongoChecksumStore(options.mongo, this.logger);
    } else if (options.postgres?.name === "PostgresSource") {
      this.store = new PostgresChecksumStore(options.postgres, this.logger);
    } else {
      throw new Error("Invalid ChecksumStore configuration");
    }
  }

  // public

  public async verify(event: HermesEvent): Promise<void> {
    this.logger.debug("Verifying event checksum", { event });

    const kit = new ShaKit({ algorithm: "SHA256", encoding: "base64" });

    const checksum = kit.hash(JSON.stringify(sortKeys(event)));

    const existing = await this.store.find({
      id: event.aggregate.id,
      name: event.aggregate.name,
      context: event.aggregate.context,
      event_id: event.id,
    });

    if (!existing) {
      return await this.store.insert({
        id: event.aggregate.id,
        name: event.aggregate.name,
        context: event.aggregate.context,
        event_id: event.id,
        checksum,
        created_at: event.timestamp,
      });
    }

    if (existing.checksum === checksum) return;

    this.logger.error("Event checksum mismatch", {
      event: {
        id: event.aggregate.id,
        name: event.aggregate.name,
        context: event.aggregate.context,
        event_id: event.id,
        checksum,
        timestamp: event.timestamp,
      },
      existing: {
        id: existing.id,
        name: existing.name,
        context: existing.context,
        event_id: existing.event_id,
        checksum: existing.checksum,
        created_at: existing.created_at,
      },
    });

    throw new ChecksumError("Event checksum mismatch");
  }
}
