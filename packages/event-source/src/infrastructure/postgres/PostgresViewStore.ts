import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { getViewStoreName } from "../../util";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import {
  CREATE_INDEX_VIEW_CAUSATION_IDENTIFIER,
  CREATE_TABLE_VIEW_CAUSATION,
} from "./sql/view-causation";
import {
  createViewStoreRevisionIndex,
  createViewStoreTable,
  getViewStoreRevisionIndexName,
} from "./sql/view-store";
import {
  HandlerIdentifier,
  IMessage,
  IViewStore,
  StandardIdentifier,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapters,
  ViewStoreAttributes,
  ViewStoreCausationAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class PostgresViewStore extends PostgresBase implements IViewStore {
  private readonly initialisedViews: Array<string>;

  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);

    this.initialisedViews = [];
  }

  public async causationExists(
    identifier: StandardIdentifier,
    causation: IMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { identifier, causation });

    try {
      await this.promise();

      const text = `
        SELECT timestamp
        FROM
          view_causation
        WHERE
          view_id = $1 AND
          view_name = $2 AND
          view_context = $3 AND
          causation_id = $4
      `;

      const values = [identifier.id, identifier.name, identifier.context, causation.id];

      const result = await this.connection.query<ViewStoreCausationAttributes>(text, values);

      return !!result.rowCount;
    } catch (err) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      await this.promise();
      await this.initialiseView(filter);

      const text = `
        UPDATE
          ${getViewStoreName(filter)}
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
    } catch (err) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(
    identifier: StandardIdentifier,
    adapters: ViewEventHandlerAdapters,
  ): Promise<ViewStoreAttributes> {
    this.logger.debug("Finding view", { identifier });

    try {
      await this.promise();
      await this.initialiseView(identifier);

      const text = `
        SELECT *
        FROM
          ${getViewStoreName(identifier)}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3
      `;

      const values = [identifier.id, identifier.name, identifier.context];

      const result = await this.connection.query<ViewStoreAttributes>(text, values);

      if (!result.rows.length) {
        this.logger.debug("View not found");

        return;
      }

      this.logger.debug("Found view", { result });

      const [data] = result.rows;

      return {
        id: data.id,
        name: data.name,
        context: data.context,
        destroyed: data.destroyed,
        hash: data.hash,
        meta: parseBlob(data.meta),
        processed_causation_ids: data.processed_causation_ids,
        revision: data.revision,
        state: parseBlob(data.state),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    try {
      await this.promise();
      await this.initialiseView(attributes);

      const text = `
        INSERT INTO ${getViewStoreName(attributes)} (
          id,
          name,
          context,
          destroyed,
          hash,
          meta,
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
        stringifyBlob(attributes.meta),
        JSON.stringify(attributes.processed_causation_ids),
        attributes.revision,
        stringifyBlob(attributes.state),
      ];

      const result = await this.connection.query(text, values);

      this.logger.debug("Inserted view", { result });
    } catch (err) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    identifier: StandardIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", { identifier, causationIds });

    try {
      await this.promise();

      let num = 1;
      let text = `
        INSERT INTO view_causation (
          view_id,
          view_name,
          view_context,
          causation_id
        ) VALUES
      `;
      const values = [];

      for (const causationId of causationIds) {
        text += `($${num}, $${num + 1}, $${num + 2}, $${num + 3}),`;
        num += 4;

        values.push(identifier.id);
        values.push(identifier.name);
        values.push(identifier.context);
        values.push(causationId);
      }

      text = text.trim().slice(0, -1);

      const result = await this.connection.query(text, values);

      this.logger.debug("Inserted processed causation ids", { result });
    } catch (err) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }

  public async update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapters: ViewEventHandlerAdapters,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    try {
      await this.promise();
      await this.initialiseView(filter);

      const text = `
        UPDATE
          ${getViewStoreName(filter)}
        SET
          destroyed = $1,
          hash = $2,
          meta = $3,
          processed_causation_ids = $4,
          revision = $5,
          state = $6,
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
        data.hash,
        stringifyBlob(data.meta),
        JSON.stringify(data.processed_causation_ids),
        data.revision,
        stringifyBlob(data.state),
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
        filter.revision,
      ];

      const result = await this.connection.query(text, values);

      this.logger.debug("Updated view", { result });
    } catch (err) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    // view_causation

    const causationExists = await this.tableExists("view_causation");
    if (!causationExists) {
      await this.connection.query(CREATE_TABLE_VIEW_CAUSATION);
    }

    const causationIndicesExist = await this.indicesExist("view_causation", [
      "view_causation_pkey",
      "idx_view_causation_identifier",
    ]);
    if (!causationIndicesExist) {
      await this.connection.query(CREATE_INDEX_VIEW_CAUSATION_IDENTIFIER);
    }

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private

  private async initialiseView(view: HandlerIdentifier): Promise<void> {
    const storeName = getViewStoreName(view);

    if (this.initialisedViews.includes(storeName)) return;

    const storeExists = await this.tableExists(storeName);
    if (!storeExists) {
      await this.connection.query(createViewStoreTable(view));
    }

    const storeIndicesExist = await this.indicesExist(storeName, [
      `${storeName}_pkey`,
      getViewStoreRevisionIndexName(view),
    ]);
    if (!storeIndicesExist) {
      await this.connection.query(createViewStoreRevisionIndex(view));
    }

    this.initialisedViews.push(storeName);
  }
}
