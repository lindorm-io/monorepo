import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IPostgresSource } from "@lindorm/postgres";
import {
  SAGA_CAUSATION,
  SAGA_CAUSATION_INDEXES,
  SAGA_STORE,
  SAGA_STORE_INDEXES,
} from "../../constants/private";
import { IHermesMessage, ISagaStore } from "../../interfaces";
import {
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
  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);
  }

  public async causationExists(
    sagaIdentifier: SagaIdentifier,
    causation: IHermesMessage,
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

      const values = [
        sagaIdentifier.id,
        sagaIdentifier.name,
        sagaIdentifier.context,
        causation.id,
      ];

      const result = await this.source.query<SagaCausationAttributes>(text, values);

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
        JsonKit.stringify(data.messages_to_dispatch),
        data.hash,
        data.revision,
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
        filter.revision,
      ];

      await this.source.query(text, values);

      this.logger.debug("Cleared messages", { filter, data });
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

      await this.source.query(text, values);

      this.logger.debug("Cleared processed causation ids", { filter, data });
    } catch (err: any) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(
    sagaIdentifier: SagaIdentifier,
  ): Promise<SagaStoreAttributes | undefined> {
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

      const result = await this.source.query<SagaStoreAttributes>(text, values);

      if (!result.rows.length) {
        this.logger.debug("Saga not found");

        return;
      }

      const [data] = result.rows;

      this.logger.debug("Found saga", { data });

      return {
        id: data.id,
        name: data.name,
        context: data.context,
        destroyed: data.destroyed,
        hash: data.hash,
        messages_to_dispatch: JsonKit.parse(data.messages_to_dispatch),
        processed_causation_ids: data.processed_causation_ids,
        revision: data.revision,
        state: JsonKit.parse(data.state),
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
        JsonKit.stringify(attributes.messages_to_dispatch),
        JSON.stringify(attributes.processed_causation_ids),
        attributes.revision,
        JsonKit.stringify(attributes.state),
      ];

      await this.source.query(text, values);

      this.logger.debug("Inserted saga", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert saga", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    sagaIdentifier: SagaIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", {
      sagaIdentifier,
      causationIds,
    });

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

      await this.source.query(text, values);

      this.logger.debug("Inserted processed causation ids", {
        sagaIdentifier,
        causationIds,
      });
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
        JsonKit.stringify(data.messages_to_dispatch),
        JSON.stringify(data.processed_causation_ids),
        JsonKit.stringify(data.state),
        data.hash,
        data.revision,
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
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
