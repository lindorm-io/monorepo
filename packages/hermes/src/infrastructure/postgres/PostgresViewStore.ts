import { ILogger } from "@lindorm/logger";
import { IPostgresQueryBuilder, IPostgresSource } from "@lindorm/postgres";
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
  private readonly qbCausation: IPostgresQueryBuilder<ViewCausationAttributes>;

  public constructor(source: IPostgresSource, logger: ILogger) {
    super(source, logger);

    this.initialisedViews = [];
    this.qbCausation = source.queryBuilder<ViewCausationAttributes>(VIEW_CAUSATION);
  }

  public async causationExists(
    viewIdentifier: ViewIdentifier,
    causation: IHermesMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { viewIdentifier, causation });

    try {
      await this.promise();

      const result = await this.source.query(
        this.qbCausation.select(
          {
            id: viewIdentifier.id,
            name: viewIdentifier.name,
            context: viewIdentifier.context,
            causation_id: causation.id,
          },
          {
            columns: ["id"],
          },
        ),
      );

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
          processed_causation_ids = ?,
          hash = ?,
          revision = ?
        WHERE 
          id = ? AND 
          name = ? AND 
          context = ? AND 
          hash = ? AND 
          revision = ?
      `;

      const values = [
        data.processed_causation_ids,
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

      const qb = this.queryBuilder(viewIdentifier);

      const result = await this.source.query(qb.select(viewIdentifier));

      if (!result.rowCount) {
        this.logger.debug("View not found");

        return;
      }

      const [data] = result.rows;

      this.logger.debug("Found view", { data });

      return data;
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

      const qb = this.queryBuilder(attributes);

      await this.source.query(
        qb.insert({
          ...attributes,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      );

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

      await this.source.query(
        this.qbCausation.insertMany(
          causationIds.map((causationId) => ({
            id: viewIdentifier.id,
            name: viewIdentifier.name,
            context: viewIdentifier.context,
            causation_id: causationId,
            timestamp: new Date(),
          })),
        ),
      );

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
          destroyed = ?,
          hash = ?,
          meta = ?,
          processed_causation_ids = ?,
          revision = ?,
          state = ?,
          updated_at = ?
        WHERE
          id = ? AND 
          name = ? AND 
          context = ? AND 
          hash = ? AND 
          revision = ?
      `;

      const values = [
        data.destroyed,
        data.hash,
        data.meta,
        data.processed_causation_ids,
        data.revision,
        data.state,
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

  protected queryBuilder(
    filter: ViewIdentifier,
  ): IPostgresQueryBuilder<ViewStoreAttributes> {
    return this.source.queryBuilder<ViewStoreAttributes>(getViewStoreName(filter));
  }

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
