import { ILogger } from "@lindorm/logger";
import { IPostgresQueryBuilder, IPostgresSource } from "@lindorm/postgres";
import {
  SAGA_CAUSATION,
  SAGA_CAUSATION_INDEXES,
  SAGA_STORE,
  SAGA_STORE_INDEXES,
} from "../../constants/private";
import { ISagaStore } from "../../interfaces";
import {
  SagaCausationAttributes,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateAttributes,
  SagaUpdateFilter,
} from "../../types";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_SAGA_CAUSATION } from "./sql/saga-causation";
import { CREATE_TABLE_SAGA_STORE } from "./sql/saga-store";

export class PostgresSagaStore extends PostgresBase implements ISagaStore {
  private readonly qbSaga: IPostgresQueryBuilder<SagaStoreAttributes>;
  private readonly qbCausation: IPostgresQueryBuilder<SagaCausationAttributes>;

  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);

    this.qbSaga = source.queryBuilder<SagaStoreAttributes>(SAGA_STORE);
    this.qbCausation = source.queryBuilder<SagaCausationAttributes>(SAGA_CAUSATION);
  }

  // public

  public async findCausationIds(sagaIdentifier: SagaIdentifier): Promise<Array<string>> {
    this.logger.debug("Finding causation ids", { sagaIdentifier });

    try {
      await this.promise();

      const result = await this.source.query(
        this.qbCausation.select(
          {
            id: sagaIdentifier.id,
            name: sagaIdentifier.name,
            context: sagaIdentifier.context,
          },
          {
            columns: ["causation_id"],
          },
        ),
      );

      const causationIds = result.rows.map((row) => row.causation_id);

      this.logger.debug("Found causation ids", { causationIds });

      return causationIds;
    } catch (err: any) {
      this.logger.error("Failed to find causation ids", err);
      throw err;
    }
  }

  public async findSaga(
    sagaIdentifier: SagaIdentifier,
  ): Promise<SagaStoreAttributes | undefined> {
    this.logger.debug("Finding saga", { sagaIdentifier });

    try {
      await this.promise();

      const result = await this.source.query(
        this.qbSaga.select({
          id: sagaIdentifier.id,
          name: sagaIdentifier.name,
          context: sagaIdentifier.context,
        }),
      );

      if (!result.rowCount) {
        this.logger.debug("Saga not found");
        return;
      }

      const [data] = result.rows;

      this.logger.debug("Found saga", { data });

      return data;
    } catch (err: any) {
      this.logger.error("Failed to find saga", err);
      throw err;
    }
  }

  public async insertCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting causation ids", {
      sagaIdentifier,
      causationIds,
    });

    try {
      await this.promise();

      await this.source.query(
        this.qbCausation.insertMany(
          causationIds.map((causationId) => ({
            id: sagaIdentifier.id,
            name: sagaIdentifier.name,
            context: sagaIdentifier.context,
            causation_id: causationId,
            timestamp: new Date(),
          })),
        ),
      );

      this.logger.debug("Inserted processed causation ids", {
        sagaIdentifier,
        causationIds,
      });
    } catch (err: any) {
      this.logger.error("Failed to ", err);
      throw err;
    }
  }

  public async insertSaga(attributes: SagaStoreAttributes): Promise<void> {
    this.logger.debug("Inserting saga", { attributes });

    try {
      await this.promise();

      await this.source.query(
        this.qbSaga.insert({
          ...attributes,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      );

      this.logger.debug("Inserted saga", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert saga", err);
      throw err;
    }
  }

  public async updateSaga(
    filter: SagaUpdateFilter,
    data: SagaUpdateAttributes,
  ): Promise<void> {
    this.logger.debug("Updating saga", { filter, data });

    try {
      await this.promise();

      const text = `
        UPDATE
          ${SAGA_STORE}
        SET
          destroyed = ?,
          messages_to_dispatch = ?,
          processed_causation_ids = ?,
          revision = ?,
          state = ?,
          updated_at = ?
        WHERE 
          id = ? AND 
          name = ? AND 
          context = ? AND 
          revision = ?
      `;

      const values = [
        data.destroyed,
        data.messages_to_dispatch,
        data.processed_causation_ids,
        data.revision,
        data.state,
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.revision,
      ];

      await this.source.query(text, values);

      this.logger.debug("Updated saga", { filter, data });
    } catch (err: any) {
      this.logger.error("Failed to ", err);
      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    await this.connect();

    // saga_store

    const storeExists = await this.tableExists(SAGA_STORE);
    if (!storeExists) {
      await this.source.query(CREATE_TABLE_SAGA_STORE);
    }

    const missingStoreIndexes = await this.getMissingIndexes<SagaStoreAttributes>(
      SAGA_STORE,
      SAGA_STORE_INDEXES,
    );
    await this.createIndexes(SAGA_STORE, missingStoreIndexes);

    // saga_causation

    const causationExists = await this.tableExists("saga_causation");
    if (!causationExists) {
      await this.source.query(CREATE_TABLE_SAGA_CAUSATION);
    }

    const missingCausationIndexes = await this.getMissingIndexes<SagaCausationAttributes>(
      SAGA_CAUSATION,
      SAGA_CAUSATION_INDEXES,
    );
    await this.createIndexes(SAGA_CAUSATION, missingCausationIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
