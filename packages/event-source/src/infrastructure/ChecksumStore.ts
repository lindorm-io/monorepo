import { sortObjectKeys } from "@lindorm-io/core";
import { Logger } from "@lindorm-io/core-logger";
import { createShaHash } from "@lindorm-io/crypto";
import { ChecksumStoreType } from "../enum";
import { ChecksumError } from "../error";
import { DomainEvent } from "../message";
import { ChecksumStoreOptions, IChecksumStore, IDomainChecksumStore } from "../types";
import { MemoryChecksumStore } from "./memory";
import { MongoChecksumStore } from "./mongo";
import { PostgresChecksumStore } from "./postgres";

export class ChecksumStore implements IDomainChecksumStore {
  private readonly store: IChecksumStore;
  private readonly logger: Logger;

  public constructor(options: ChecksumStoreOptions, logger: Logger) {
    switch (options.type) {
      case ChecksumStoreType.CUSTOM:
        if (!options.custom) throw new Error("Custom Checksum Store not provided");
        this.store = options.custom;
        break;

      case ChecksumStoreType.MEMORY:
        this.store = new MemoryChecksumStore();
        break;

      case ChecksumStoreType.MONGO:
        if (!options.mongo) throw new Error("Mongo connection not provided");
        this.store = new MongoChecksumStore(options.mongo, logger);
        break;

      case ChecksumStoreType.POSTGRES:
        if (!options.postgres) throw new Error("Postgres connection not provided");
        this.store = new PostgresChecksumStore(options.postgres, logger);
        break;

      default:
        throw new Error("Invalid ChecksumStore type");
    }

    this.logger = logger.createChildLogger(["ChecksumStore"]);
  }

  // public

  public async verify(event: DomainEvent): Promise<void> {
    this.logger.debug("Verifying event checksum", { event });

    const checksum = createShaHash({
      algorithm: "SHA256",
      data: JSON.stringify(sortObjectKeys(event)),
      format: "base64",
    });

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
        timestamp: event.timestamp,
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
        timestamp: existing.timestamp,
      },
    });

    throw new ChecksumError("Event checksum mismatch");
  }
}
