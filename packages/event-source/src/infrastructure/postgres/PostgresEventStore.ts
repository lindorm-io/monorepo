import { CREATE_TABLE_EVENT_STORE } from "./sql/event-store";
import { EVENT_STORE, EVENT_STORE_INDEXES } from "../../constant";
import { IEventStore, EventStoreFindFilter, EventStoreAttributes, EventData } from "../../types";
import { Logger } from "@lindorm-io/core-logger";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";

export class PostgresEventStore extends PostgresBase implements IEventStore {
  public constructor(connection: IPostgresConnection, logger: Logger) {
    super(connection, logger);
  }

  // public

  public async find(filter: EventStoreFindFilter): Promise<Array<EventData>> {
    this.logger.debug("Finding event entities", { filter });

    try {
      await this.promise();

      let text = `
        SELECT *
        FROM
          ${EVENT_STORE}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3`;

      const values = [filter.id, filter.name, filter.context];

      if (filter.causation_id) {
        text += " AND causation_id = $4";
        values.push(filter.causation_id);
      }

      text += " ORDER BY expected_events ASC";

      const result = await this.connection.query<EventStoreAttributes>(text, values);

      this.logger.debug("Found event entities", { result });

      return PostgresEventStore.toEventData(result.rows);
    } catch (err: any) {
      this.logger.error("Failed to find event entities", err);

      throw err;
    }
  }

  public async insert(data: EventStoreAttributes): Promise<void> {
    this.logger.debug("Inserting event entity", { data });

    try {
      await this.promise();

      const text = `
        INSERT INTO ${EVENT_STORE} (
          id,
          name,
          context,
          causation_id,
          correlation_id,
          events,
          expected_events,
          previous_event_id,
          timestamp
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `;

      const values = [
        data.id,
        data.name,
        data.context,
        data.causation_id,
        data.correlation_id,
        stringifyBlob(data.events),
        data.expected_events,
        data.previous_event_id,
        data.timestamp,
      ];

      const result = await this.connection.query(text, values);

      this.logger.verbose("Inserted event entity", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert event entity", err);

      throw err;
    }
  }

  public async listEvents(from: Date, limit: number): Promise<Array<EventData>> {
    this.logger.debug("Listing event entities", { from, limit });

    try {
      await this.promise();

      const text = `
        SELECT * FROM ${EVENT_STORE}
        WHERE timestamp >= $1
          ORDER BY timestamp ASC
          LIMIT $2`;

      const values = [from, limit];

      const result = await this.connection.query<EventStoreAttributes>(text, values);

      this.logger.debug("Found event entities", { result });

      return PostgresEventStore.toEventData(result.rows);
    } catch (err: any) {
      this.logger.error("Failed to list event entities", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    const storeExists = await this.tableExists(EVENT_STORE);
    if (!storeExists) {
      await this.connection.query(CREATE_TABLE_EVENT_STORE);
    }

    const missingIndexes = await this.getMissingIndexes<EventStoreAttributes>(
      EVENT_STORE,
      EVENT_STORE_INDEXES,
    );
    await this.createIndexes(EVENT_STORE, missingIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private static

  private static toEventData(entities: Array<EventStoreAttributes>): Array<EventData> {
    const result: Array<EventData> = [];

    for (const item of entities) {
      const events = parseBlob<Array<EventData>>(item.events);

      for (const event of events) {
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
          meta: event.meta,
          timestamp: new Date(event.timestamp),
          version: event.version,
        });
      }
    }

    return result;
  }
}
