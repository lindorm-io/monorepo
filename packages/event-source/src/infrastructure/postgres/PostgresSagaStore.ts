import { Logger } from "@lindorm-io/core-logger";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import {
  SAGA_CAUSATION,
  SAGA_CAUSATION_INDEXES,
  SAGA_STORE,
  SAGA_STORE_INDEXES,
} from "../../constant";
import {
  IMessage,
  ISagaStore,
  SagaCausationAttributes,
  SagaClearMessagesToDispatchData,
  SagaClearProcessedCausationIdsData,
  SagaIdentifier,
  SagaStoreAttributes,
  SagaUpdateData,
  SagaUpdateFilter,
} from "../../types";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_SAGA_CAUSATION } from "./sql/saga-causation";
import { CREATE_TABLE_SAGA_STORE } from "./sql/saga-store";

export class PostgresSagaStore extends PostgresBase implements ISagaStore {
  public constructor(connection: IPostgresConnection, logger: Logger) {
    super(connection, logger);
  }

  public async causationExists(
    sagaIdentifier: SagaIdentifier,
    causation: IMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { sagaIdentifier, causation });

    try {
      await this.promise();

      const text = `
        SELECT timestamp
        FROM
          ${SAGA_CAUSATION}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3 AND
          causation_id = $4
      `;

      const values = [sagaIdentifier.id, sagaIdentifier.name, sagaIdentifier.context, causation.id];

      const result = await this.connection.query<SagaCausationAttributes>(text, values);

      return !!result.rowCount;
    } catch (err: any) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearMessagesToDispatch(
    filter: SagaUpdateFilter,
    data: SagaClearMessagesToDispatchData,
  ): Promise<void> {
    this.logger.debug("Clearing messages", { filter, data });

    try {
      await this.promise();

      const text = `
        UPDATE
          ${SAGA_STORE}
        SET
          messages_to_dispatch = $1,
          hash = $2,
          revision = $3,
          updated_at = $4
        WHERE 
          id = $5 AND 
          name = $6 AND 
          context = $7 AND 
          hash = $8 AND 
          revision = $9
      `;

      const values = [
        stringifyBlob(data.messages_to_dispatch),
        data.hash,
        data.revision,
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
        filter.revision,
      ];

      const result = await this.connection.query(text, values);

      this.logger.debug("Cleared messages", { result });
    } catch (err: any) {
      this.logger.error("Failed to clear messages", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: SagaUpdateFilter,
    data: SagaClearProcessedCausationIdsData,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      await this.promise();

      const text = `
        UPDATE
          ${SAGA_STORE}
        SET
          processed_causation_ids = $1,
          hash = $2,
          revision = $3
        WHERE 
          id = $4 AND 
          name = $5 AND 
          context = $6 AND 
          hash = $7 AND 
          revision = $8
      `;

      const values = [
        JSON.stringify(data.processed_causation_ids),
        data.hash,
        data.revision,

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
        filter.revision,
      ];

      const result = await this.connection.query(text, values);

      this.logger.debug("Cleared processed causation ids", { result });
    } catch (err: any) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(sagaIdentifier: SagaIdentifier): Promise<SagaStoreAttributes | undefined> {
    this.logger.debug("Finding saga", { sagaIdentifier });

    try {
      await this.promise();

      const text = `
        SELECT *
        FROM
          ${SAGA_STORE}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3
      `;

      const values = [sagaIdentifier.id, sagaIdentifier.name, sagaIdentifier.context];

      const result = await this.connection.query<SagaStoreAttributes>(text, values);

      if (!result.rows.length) {
        this.logger.debug("Saga not found");

        return;
      }

      this.logger.debug("Found saga", { result });

      const [data] = result.rows;

      return {
        id: data.id,
        name: data.name,
        context: data.context,
        destroyed: data.destroyed,
        hash: data.hash,
        messages_to_dispatch: parseBlob(data.messages_to_dispatch),
        processed_causation_ids: data.processed_causation_ids,
        revision: data.revision,
        state: parseBlob(data.state),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (err: any) {
      this.logger.error("Failed to find saga", err);

      throw err;
    }
  }

  public async insert(attributes: SagaStoreAttributes): Promise<void> {
    this.logger.debug("Inserting saga", { attributes });

    try {
      await this.promise();

      const text = `
        INSERT INTO ${SAGA_STORE} (
          id,
          name,
          context,
          destroyed,
          hash,
          messages_to_dispatch,
          processed_causation_ids,
          revision,
          state
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `;

      const values = [
        attributes.id,
        attributes.name,
        attributes.context,
        attributes.destroyed,
        attributes.hash,
        stringifyBlob(attributes.messages_to_dispatch),
        JSON.stringify(attributes.processed_causation_ids),
        attributes.revision,
        stringifyBlob(attributes.state),
      ];

      const result = await this.connection.query(text, values);

      this.logger.debug("Inserted saga", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert saga", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", { sagaIdentifier, causationIds });

    try {
      await this.promise();

      let num = 1;
      let text = `
        INSERT INTO ${SAGA_CAUSATION} (
          id,
          name,
          context,
          causation_id
        ) VALUES
      `;
      const values = [];

      for (const causationId of causationIds) {
        text += `($${num}, $${num + 1}, $${num + 2}, $${num + 3}),`;
        num += 4;

        values.push(sagaIdentifier.id);
        values.push(sagaIdentifier.name);
        values.push(sagaIdentifier.context);
        values.push(causationId);
      }

      text = text.trim().slice(0, -1);

      const result = await this.connection.query(text, values);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err: any) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }

  public async update(filter: SagaUpdateFilter, data: SagaUpdateData): Promise<void> {
    this.logger.debug("Updating saga", { filter, data });

    try {
      await this.promise();

      const text = `
        UPDATE
          ${SAGA_STORE}
        SET
          destroyed = $1,
          messages_to_dispatch = $2,
          processed_causation_ids = $3,
          state = $4,
          hash = $5,
          revision = $6,
          updated_at = $7
        WHERE 
          id = $8 AND 
          name = $9 AND 
          context = $10 AND 
          hash = $11 AND 
          revision = $12
      `;

      const values = [
        data.destroyed,
        stringifyBlob(data.messages_to_dispatch),
        JSON.stringify(data.processed_causation_ids),
        stringifyBlob(data.state),
        data.hash,
        data.revision,
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
        filter.revision,
      ];

      const result = await this.connection.query(text, values);

      this.logger.debug("Updated saga", { result });
    } catch (err: any) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    // saga_store

    const storeExists = await this.tableExists(SAGA_STORE);
    if (!storeExists) {
      await this.connection.query(CREATE_TABLE_SAGA_STORE);
    }

    const missingStoreIndexes = await this.getMissingIndexes<SagaStoreAttributes>(
      SAGA_STORE,
      SAGA_STORE_INDEXES,
    );
    await this.createIndexes(SAGA_STORE, missingStoreIndexes);

    // saga_causation

    const causationExists = await this.tableExists("saga_causation");
    if (!causationExists) {
      await this.connection.query(CREATE_TABLE_SAGA_CAUSATION);
    }

    const missingCausationIndexes = await this.getMissingIndexes<SagaCausationAttributes>(
      SAGA_CAUSATION,
      SAGA_CAUSATION_INDEXES,
    );
    await this.createIndexes(SAGA_CAUSATION, missingCausationIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
