import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { ViewCausationEntity, ViewEntity } from "./entity";
import {
  IMessage,
  IViewStore,
  StandardIdentifier,
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapters,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../../types";

export class PostgresViewStore extends PostgresBase implements IViewStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);
  }

  public async causationExists(
    identifier: StandardIdentifier,
    causation: IMessage,
  ): Promise<boolean> {
    this.logger.debug("Verifying if causation exists", { identifier, causation });

    try {
      const result = await this.connection.getRepository(ViewCausationEntity).findOneBy({
        view_id: identifier.id,
        view_name: identifier.name,
        view_context: identifier.context,
        causation_id: causation.id,
      });

      return !!result;
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
      const ViewEntity = this.viewEntity(adapters);

      const result = await this.connection.getRepository(ViewEntity).update(
        {
          id: filter.id,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          hash: data.hash,
          processed_causation_ids: data.processed_causation_ids,
          revision: data.revision,
        },
      );

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
      const ViewEntity = this.viewEntity(adapters);

      const result = await this.connection.getRepository(ViewEntity).findOneBy({
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
      });

      if (!result) {
        this.logger.debug("View not found");

        return;
      }

      this.logger.debug("Found view", { result });

      return result;
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
      const ViewEntity = this.viewEntity(adapters);

      const result = await this.connection.getRepository(ViewEntity).insert({
        id: attributes.id,
        name: attributes.name,
        context: attributes.context,
        destroyed: attributes.destroyed,
        hash: attributes.hash,
        meta: attributes.meta,
        processed_causation_ids: attributes.processed_causation_ids,
        revision: attributes.revision,
        state: attributes.state,
        created_at: attributes.created_at,
        updated_at: attributes.updated_at,
      });

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
      const result = await this.connection.client
        .createQueryBuilder()
        .insert()
        .into(ViewCausationEntity)
        .values(
          causationIds.map((causationId) => ({
            view_id: identifier.id,
            view_name: identifier.name,
            view_context: identifier.context,
            causation_id: causationId,
          })),
        )
        .execute();

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
      const ViewEntity = this.viewEntity(adapters);

      const result = await this.connection.getRepository(ViewEntity).update(
        {
          id: filter.id,
          hash: filter.hash,
          revision: filter.revision,
        },
        {
          destroyed: data.destroyed,
          hash: data.hash,
          meta: data.meta,
          processed_causation_ids: data.processed_causation_ids,
          revision: data.revision,
          state: data.state,
        },
      );

      this.logger.debug("Updated view", { result });
    } catch (err) {
      this.logger.error("Failed to ", err);

      throw err;
    }
  }

  // private

  private viewEntity(adapters: ViewEventHandlerAdapters): typeof ViewEntity {
    if (!adapters.postgres?.ViewEntity) {
      throw new Error("ViewEntity not in adapter options");
    }
    return adapters.postgres.ViewEntity;
  }
}
