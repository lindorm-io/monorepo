import { LindormError } from "@lindorm/errors";
import { MongoSource } from "@lindorm/mongo";
import { PostgresSource } from "@lindorm/postgres";
import { IEventStore } from "../interfaces";
import {
  EventStoreAttributes,
  EventStoreFindFilter,
  HermesEventStoreOptions,
} from "../types";
import { MongoEventStore } from "./mongo";
import { PostgresEventStore } from "./postgres";

export class EventStore implements IEventStore {
  private readonly store: IEventStore;

  public constructor(options: HermesEventStoreOptions) {
    if (options.custom) {
      this.store = options.custom;
    } else if (options.mongo instanceof MongoSource) {
      this.store = new MongoEventStore(options.mongo, options.logger);
    } else if (options.postgres instanceof PostgresSource) {
      this.store = new PostgresEventStore(options.postgres, options.logger);
    } else {
      throw new LindormError("Invalid EventStore configuration");
    }
  }

  // public

  public async find(filter: EventStoreFindFilter): Promise<Array<EventStoreAttributes>> {
    return await this.store.find(filter);
  }

  public async insert(attributes: Array<EventStoreAttributes>): Promise<void> {
    return await this.store.insert(attributes);
  }

  public async listEvents(
    from: Date,
    limit: number,
  ): Promise<Array<EventStoreAttributes>> {
    return await this.store.listEvents(from, limit);
  }
}
