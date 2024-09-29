import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IPostgresSource } from "@lindorm/postgres";
import { EVENT_STORE, EVENT_STORE_INDEXES } from "../../constants/private";
import { IEventStore } from "../../interfaces";
import { EventData, EventStoreAttributes, EventStoreFindFilter } from "../../types";
import { assertChecksum } from "../../utils/private";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_EVENT_STORE } from "./sql/event-store";

export class PostgresEventStore extends PostgresBase implements IEventStore {
  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);
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

      const result = await this.source.query<EventStoreAttributes>(text, values);
      const entities = PostgresEventStore.toParsedEntities(result.rows);

      this.logger.debug("Found event entities", { amount: entities.length });

      this.warnIfChecksumMismatch(entities);

      return PostgresEventStore.toEventData(entities);
    } catch (err: any) {
      this.logger.error("Failed to find event entities", err);

      throw err;
    }
  }

  public async insert(attributes: EventStoreAttributes): Promise<void> {
    this.logger.debug("Inserting event entity", { attributes });

    try {
      await this.promise();

      const text = `
        INSERT INTO ${EVENT_STORE} (
          id,
          name,
          context,
          causation_id,
          checksum,
          correlation_id,
          events,
          expected_events,
          previous_event_id,
          timestamp
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `;

      const values = [
        attributes.id,
        attributes.name,
        attributes.context,
        attributes.causation_id,
        attributes.checksum,
        attributes.correlation_id,
        JsonKit.stringify(attributes.events),
        attributes.expected_events,
        attributes.previous_event_id,
        attributes.timestamp,
      ];

      await this.source.query(text, values);

      this.logger.verbose("Inserted event entity", { attributes });
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
        SELECT *
          FROM ${EVENT_STORE}
        WHERE timestamp >= $1
          ORDER BY timestamp ASC
          LIMIT $2`;

      const values = [from, limit];

      const result = await this.source.query<EventStoreAttributes>(text, values);
      const entities = PostgresEventStore.toParsedEntities(result.rows);

      this.logger.debug("Found event entities", { amount: entities.length });

      return PostgresEventStore.toEventData(entities);
    } catch (err: any) {
      this.logger.error("Failed to list event entities", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    await this.connect();

    const storeExists = await this.tableExists(EVENT_STORE);
    if (!storeExists) {
      await this.source.query(CREATE_TABLE_EVENT_STORE);
    }

    const missingIndexes = await this.getMissingIndexes<EventStoreAttributes>(
      EVENT_STORE,
      EVENT_STORE_INDEXES,
    );
    await this.createIndexes(EVENT_STORE, missingIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private

  private async warnIfChecksumMismatch(
    entities: Array<EventStoreAttributes>,
  ): Promise<void> {
    for (const entity of entities) {
      try {
        assertChecksum(entity);
      } catch (error: any) {
        this.logger.warn("Checksum mismatch", error, [{ entity }]);
      }
    }
  }

  // private static

  private static toParsedEntities(
    rows: Array<EventStoreAttributes>,
  ): Array<EventStoreAttributes> {
    const result: Array<EventStoreAttributes> = [];

    for (const row of rows) {
      const events = JsonKit.parse<Array<EventData>>(JSON.stringify(row.events));

      result.push({ ...row, events });
    }

    return result;
  }

  private static toEventData(entities: Array<EventStoreAttributes>): Array<EventData> {
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
          meta: event.meta,
          timestamp: new Date(event.timestamp),
          version: event.version,
        });
      }
    }

    return result;
  }
}
