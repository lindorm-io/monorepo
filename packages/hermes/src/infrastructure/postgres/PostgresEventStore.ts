import { ILogger } from "@lindorm/logger";
import { IPostgresQueryBuilder, IPostgresSource } from "@lindorm/postgres";
import { EVENT_STORE, EVENT_STORE_INDEXES } from "../../constants/private";
import { IEventStore } from "../../interfaces";
import { EventStoreAttributes, EventStoreFindFilter } from "../../types";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_EVENT_STORE } from "./sql/event-store";

export class PostgresEventStore extends PostgresBase implements IEventStore {
  private readonly qb: IPostgresQueryBuilder<EventStoreAttributes>;

  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);

    this.qb = source.queryBuilder<EventStoreAttributes>(EVENT_STORE);
  }

  // public

  public async find(filter: EventStoreFindFilter): Promise<Array<EventStoreAttributes>> {
    this.logger.debug("Finding event entities", { filter });

    try {
      await this.promise();

      const result = await this.source.query(
        this.qb.select(
          {
            aggregate_id: filter.id,
            aggregate_name: filter.name,
            aggregate_namespace: filter.namespace,
            ...(filter.causation_id ? { causation_id: filter.causation_id } : {}),
          },
          {
            order: { expected_events: "ASC" },
          },
        ),
      );

      this.logger.debug("Found event entities", { amount: result.rowCount });

      return result.rows;
    } catch (err: any) {
      this.logger.error("Failed to find event entities", err);

      throw err;
    }
  }

  public async insert(attributes: Array<EventStoreAttributes>): Promise<void> {
    this.logger.debug("Inserting event entity", { attributes });

    try {
      await this.promise();

      await this.source.query(this.qb.insertMany(attributes));

      this.logger.verbose("Inserted events", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert events", err);

      throw err;
    }
  }

  public async listEvents(
    from: Date,
    limit: number,
  ): Promise<Array<EventStoreAttributes>> {
    this.logger.debug("Listing event entities", { from, limit });

    try {
      await this.promise();

      const text = `
        SELECT *
          FROM ${EVENT_STORE}
        WHERE created_at >= ?
          ORDER BY created_at ASC
          LIMIT ?`;

      const values = [from, limit];

      const result = await this.source.query<EventStoreAttributes>(text, values);

      this.logger.debug("Found events", { amount: result.rowCount });

      return result.rows;
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
}
