import { EventEntity } from "./entity";
import { IEventStore, EventStoreFindFilter, EventStoreAttributes, EventData } from "../../types";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { MoreThanOrEqual } from "typeorm";
import { PostgresBase } from "./PostgresBase";

export class PostgresEventStore extends PostgresBase implements IEventStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);
  }

  // public

  public async find(filter: EventStoreFindFilter): Promise<Array<EventData>> {
    this.logger.debug("Finding event entities", { filter });

    try {
      const repository = this.connection.getRepository(EventEntity);

      const entities = await repository.find({
        order: { expected_events: "ASC" },
        where: filter,
      });

      this.logger.debug("Found event entities", { entities });

      return PostgresEventStore.toEventData(entities);
    } catch (err) {
      this.logger.error("Failed to find event entities", err);

      throw err;
    }
  }

  public async insert(data: EventStoreAttributes): Promise<void> {
    this.logger.debug("Inserting event entity", { data });

    try {
      const repository = this.connection.getRepository(EventEntity);

      const result = await repository.insert({
        id: data.id,
        name: data.name,
        context: data.context,
        causation_id: data.causation_id,
        correlation_id: data.correlation_id,
        events: data.events,
        expected_events: data.expected_events,
        origin: data.origin,
        originId: data.originId,
        previous_event_id: data.previous_event_id,
        timestamp: data.timestamp,
      });

      this.logger.verbose("Inserted event entity", { result });
    } catch (err) {
      this.logger.error("Failed to insert event entity", err);

      throw err;
    }
  }

  public async listEvents(from: Date, limit: number): Promise<Array<EventData>> {
    this.logger.debug("Listing event entities", { from, limit });

    try {
      const repository = this.connection.getRepository(EventEntity);

      const entities = await repository.find({
        order: { timestamp: "ASC" },
        take: limit,
        where: { timestamp: MoreThanOrEqual(from) },
      });

      this.logger.debug("Found event entities", { entities });

      return PostgresEventStore.toEventData(entities);
    } catch (err) {
      this.logger.error("Failed to list event entities", err);

      throw err;
    }
  }

  // private

  private static toEventData(entities: Array<EventEntity>): Array<EventData> {
    const result: Array<EventData> = [];

    for (const item of entities) {
      for (const event of item.events) {
        result.push({
          id: event.id,
          name: event.name,
          aggregate: {
            id: item.id,
            name: item.name,
            context: item.context,
          },
          causation_id: item.causation_id,
          correlation_id: item.correlation_id,
          data: event.data,
          origin: item.origin,
          originId: item.originId,
          timestamp: new Date(event.timestamp),
          version: event.version,
        });
      }
    }

    return result;
  }
}
