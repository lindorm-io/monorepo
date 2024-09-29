import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IPostgresSource } from "@lindorm/postgres";
import {
  VIEW_CAUSATION,
  VIEW_CAUSATION_INDEXES,
  getViewStoreIndexes,
} from "../../constants/private";
import { IHermesMessage, IViewStore } from "../../interfaces";
import {
  HandlerIdentifier,
  ViewCausationAttributes,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { PostgresBase } from "./PostgresBase";
import { CREATE_TABLE_VIEW_CAUSATION } from "./sql/view-causation";
import { createViewStoreTable } from "./sql/view-store";

export class PostgresViewStore extends PostgresBase implements IViewStore {
  private readonly initialisedViews: Array<string>;

  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);

    this.initialisedViews = [];
  }

  public async causationExists(
    viewIdentifier: ViewIdentifier,
    causation: IHermesMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { viewIdentifier, causation });

    try {
      await this.promise();

      const text = `
        SELECT timestamp
        FROM
          ${VIEW_CAUSATION}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3 AND
          causation_id = $4
      `;

      const values = [
        viewIdentifier.id,
        viewIdentifier.name,
        viewIdentifier.context,
        causation.id,
      ];

      const result = await this.source.query<ViewCausationAttributes>(text, values);

      return !!result.rowCount;
    } catch (err: any) {
      this.logger.error("Failed to verify if causation exists", err);

      throw err;
    }
  }

  public async clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    this.logger.debug("Clearing processed causation ids", { filter, data });

    try {
      await this.promise();
      await this.initialiseView(filter, adapter);

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

      await this.source.query(text, values);

      this.logger.debug("Cleared processed causation ids", { filter, data });
    } catch (err: any) {
      this.logger.error("Failed to clear processed causation ids", err);

      throw err;
    }
  }

  public async find(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { viewIdentifier });

    try {
      await this.promise();
      await this.initialiseView(viewIdentifier, adapter);

      const text = `
        SELECT *
        FROM
          ${getViewStoreName(viewIdentifier)}
        WHERE
          id = $1 AND
          name = $2 AND
          context = $3
      `;

      const values = [viewIdentifier.id, viewIdentifier.name, viewIdentifier.context];

      const result = await this.source.query<ViewStoreAttributes>(text, values);

      if (!result.rows.length) {
        this.logger.debug("View not found");

        return;
      }

      const [data] = result.rows;

      const parsed = {
        id: data.id,
        name: data.name,
        context: data.context,
        destroyed: data.destroyed,
        hash: data.hash,
        meta: JsonKit.parse(data.meta),
        processed_causation_ids: data.processed_causation_ids,
        revision: data.revision,
        state: JsonKit.parse(data.state),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      this.logger.debug("Found view", { data, parsed });

      return parsed;
    } catch (err: any) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async insert(
    attributes: ViewStoreAttributes,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    try {
      await this.promise();
      await this.initialiseView(attributes, adapter);

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
        JsonKit.stringify(attributes.meta),
        JSON.stringify(attributes.processed_causation_ids),
        attributes.revision,
        JsonKit.stringify(attributes.state),
      ];

      await this.source.query(text, values);

      this.logger.debug("Inserted view", { attributes });
    } catch (err: any) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  public async insertProcessedCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting processed causation ids", {
      viewIdentifier,
      causationIds,
    });

    try {
      await this.promise();

      let num = 1;
      let text = `
        INSERT INTO ${VIEW_CAUSATION} (
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

        values.push(viewIdentifier.id);
        values.push(viewIdentifier.name);
        values.push(viewIdentifier.context);
        values.push(causationId);
      }

      text = text.trim().slice(0, -1);

      await this.source.query(text, values);

      this.logger.debug("Inserted processed causation ids", {
        viewIdentifier,
        causationIds,
      });
    } catch (err: any) {
      this.logger.error("Failed to insert processed causation ids", err);

      throw err;
    }
  }

  public async update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    try {
      await this.promise();
      await this.initialiseView(filter, adapter);

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
        JsonKit.stringify(data.meta),
        JSON.stringify(data.processed_causation_ids),
        data.revision,
        JsonKit.stringify(data.state),
        new Date(),

        filter.id,
        filter.name,
        filter.context,
        filter.hash,
        filter.revision,
      ];

      await this.source.query(text, values);

      this.logger.debug("Updated view", { filter, data });
    } catch (err: any) {
      this.logger.error("Failed to update view", err);

      throw err;
    }
  }

  // protected

  protected async initialise(): Promise<void> {
    await this.connect();

    // view_causation

    const causationExists = await this.tableExists("view_causation");
    if (!causationExists) {
      await this.source.query(CREATE_TABLE_VIEW_CAUSATION);
    }

    const missingCausationIndexes = await this.getMissingIndexes<ViewCausationAttributes>(
      VIEW_CAUSATION,
      VIEW_CAUSATION_INDEXES,
    );
    await this.createIndexes(VIEW_CAUSATION, missingCausationIndexes);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  // private

  private async initialiseView(
    handlerIdentifier: HandlerIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void> {
    const storeName = getViewStoreName(handlerIdentifier);
    const custom = adapter.indexes || [];
    const indexes = [getViewStoreIndexes(handlerIdentifier), custom].flat();

    if (this.initialisedViews.includes(storeName)) return;

    const storeExists = await this.tableExists(storeName);
    if (!storeExists) {
      await this.source.query(createViewStoreTable(handlerIdentifier));
    }

    const missingIndexes = await this.getMissingIndexes<ViewStoreAttributes>(
      storeName,
      indexes,
    );
    await this.createIndexes(storeName, missingIndexes);

    this.initialisedViews.push(storeName);
  }
}
