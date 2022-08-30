import { IEventStore, EventStoreFindFilter, EventStoreAttributes, EventData } from "../../types";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import {
  CREATE_INDEX_EVENT_STORE_IDENTIFIER,
  CREATE_INDEX_EVENT_STORE_UNIQUE_EXPECTED_EVENTS,
  CREATE_INDEX_EVENT_STORE_UNIQUE_PREVIOUS_EVENT,
  CREATE_TABLE_EVENT_STORE,
} from "./sql/event-store";

export class PostgresEventStore extends PostgresBase implements IEventStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
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
          event_store
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
    } catch (err) {
      this.logger.error("Failed to find event entities", err);

      throw err;
    }
  }

  public async insert(data: EventStoreAttributes): Promise<void> {
    this.logger.debug("Inserting event entity", { data });

    try {
      await this.promise();

      const text = `
        INSERT INTO event_store (
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
    } catch (err) {
      this.logger.error("Failed to insert event entity", err);

      throw err;
    }
  }

  public async listEvents(from: Date, limit: number): Promise<Array<EventData>> {
    this.logger.debug("Listing event entities", { from, limit });

    try {
      await this.promise();

      const text = `
        SELECT * FROM event_store
        WHERE timestamp >= $1
          ORDER BY timestamp ASC
          LIMIT $2`;

      const values = [from, limit];

      const result = await this.connection.query<EventStoreAttributes>(text, values);

      this.logger.debug("Found event entities", { result });

      return PostgresEventStore.toEventData(result.rows);
    } catch (err) {
      this.logger.error("Failed to list event entities", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    const storeExists = await this.tableExists("event_store");
    if (!storeExists) {
      await this.connection.query(CREATE_TABLE_EVENT_STORE);
    }

    const storeIndicesExist = await this.indicesExist("event_store", [
      "event_store_pkey",
      "idx_event_store_identifier",
      "idx_event_store_unique_expected_events",
      "idx_event_store_unique_previous_event",
    ]);
    if (!storeIndicesExist) {
      await this.connection.query(CREATE_INDEX_EVENT_STORE_IDENTIFIER);
      await this.connection.query(CREATE_INDEX_EVENT_STORE_UNIQUE_EXPECTED_EVENTS);
      await this.connection.query(CREATE_INDEX_EVENT_STORE_UNIQUE_PREVIOUS_EVENT);
    }

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
