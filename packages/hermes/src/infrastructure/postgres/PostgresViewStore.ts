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
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
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

  // public

  public async findCausationIds(viewIdentifier: ViewIdentifier): Promise<Array<string>> {
    this.logger.debug("Finding causation ids", { viewIdentifier });

    try {
      await this.promise();

      const result = await this.source.query(
        this.qbCausation.select(
          {
            id: viewIdentifier.id,
            name: viewIdentifier.name,
            namespace: viewIdentifier.namespace,
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
            namespace: viewIdentifier.namespace,
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

  public async findView(
    viewIdentifier: ViewIdentifier,
  ): Promise<ViewStoreAttributes | undefined> {
    this.logger.debug("Finding view", { viewIdentifier });

    try {
      await this.promise();
      await this.initialiseView(viewIdentifier);

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

  public async insertCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void> {
    this.logger.debug("Inserting causation ids", {
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
            namespace: viewIdentifier.namespace,
            causation_id: causationId,
            created_at: new Date(),
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

  public async insertView(attributes: ViewStoreAttributes): Promise<void> {
    this.logger.debug("Inserting view", { attributes });

    try {
      await this.promise();
      await this.initialiseView(attributes);

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

  public async updateView(
    filter: ViewUpdateFilter,
    data: ViewUpdateAttributes,
  ): Promise<void> {
    this.logger.debug("Updating view", { filter, data });

    try {
      await this.promise();
      await this.initialiseView(filter);

      const qb = this.queryBuilder(filter);

      await this.source.query(
        qb.update(filter, {
          ...data,
          updated_at: new Date(),
        }),
      );

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

  private async initialiseView(handlerIdentifier: HandlerIdentifier): Promise<void> {
    const storeName = getViewStoreName(handlerIdentifier);
    const indexes = getViewStoreIndexes(handlerIdentifier);

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
