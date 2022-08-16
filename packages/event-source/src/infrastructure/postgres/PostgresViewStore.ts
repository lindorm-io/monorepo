import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm";
import { ILogger } from "@lindorm-io/winston";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { PostgresBase } from "./PostgresBase";
import { View } from "../../model";
import { ViewCausationEntity, ViewEntity } from "./entity";
import { find } from "lodash";
import {
  IMessage,
  IView,
  IViewStore,
  ViewData,
  ViewIdentifier,
  ViewStoreHandlerOptions,
} from "../../types";

export class PostgresViewStore extends PostgresBase implements IViewStore {
  public constructor(connection: IPostgresConnection, logger: ILogger) {
    super(connection, logger);
  }

  // public

  public async save(
    view: IView,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    const json = view.toJSON();

    this.logger.debug("Saving view", {
      view: json,
      causation,
      handlerOptions,
    });

    const existing = await this.find(
      {
        id: json.id,
        name: json.name,
        context: json.context,
      },
      { where: { causation_id: causation.id } },
      handlerOptions,
    );

    if (existing && find(existing.causationList, causation.id)) {
      this.logger.debug("Found existing view matching causation", { view: existing.toJSON() });

      return existing;
    }

    if (json.revision === 0) {
      return await this.insert(json, causation, handlerOptions);
    }

    return await this.update(json, causation, handlerOptions);
  }

  public async load(
    identifier: ViewIdentifier,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    this.logger.debug("Loading view", { identifier });

    const existing = await this.find(identifier, {}, handlerOptions);

    if (existing) {
      this.logger.debug("Loading existing view", { view: existing.toJSON() });

      return existing;
    }

    const view = new View(identifier, this.logger);

    this.logger.debug("Loading ephemeral view", { view: view.toJSON() });

    return view;
  }

  // private

  private async find(
    identifier: ViewIdentifier,
    causationOptions: FindManyOptions<ViewCausationEntity> = {},
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View | undefined> {
    await this.promise();

    const viewFilter: FindOneOptions<ViewEntity> = {
      cache: false,
      where: {
        id: identifier.id,
        name: identifier.name,
        context: identifier.context,
      },
    };

    const causationFilter: FindManyOptions<ViewCausationEntity> = {
      cache: true,
      order: {
        timestamp: "ASC",
        ...(causationOptions.order || {}),
      },
      where: {
        view_id: identifier.id,
        view_name: identifier.name,
        view_context: identifier.context,
        ...(causationOptions.where || {}),
      },
      ...causationOptions,
    };

    this.logger.debug("Finding view", {
      viewFilter,
      causationFilter,
    });

    try {
      const viewEntity = await this.connection
        .getRepository(handlerOptions.postgres.viewEntity)
        .findOne(viewFilter);

      if (!viewEntity) {
        this.logger.debug("View not found");
        return;
      }

      this.logger.debug("Found view entity", { viewEntity });

      const causationEntities = await this.connection
        .getRepository(handlerOptions.postgres.causationEntity)
        .find(causationFilter);

      this.logger.debug("Found causation entities", { causationEntities });

      const causationList: Array<string> = [];
      for (const entity of causationEntities) {
        causationList.push(entity.causation_id);
      }

      return new View(
        {
          id: viewEntity.id,
          name: viewEntity.name,
          context: viewEntity.context,
          causationList,
          destroyed: viewEntity.destroyed,
          meta: viewEntity.meta,
          revision: viewEntity.revision,
          state: viewEntity.state,
        },
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  private async insert(
    view: ViewData,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    await this.promise();

    this.logger.debug("Inserting view", {
      view,
      causation,
      handlerOptions,
    });

    try {
      return await this.connection.transaction<View>(async (manager) => {
        const savedView = await manager.getRepository(handlerOptions.postgres.viewEntity).save({
          id: view.id,
          name: view.name,
          context: view.context,
          destroyed: view.destroyed,
          meta: view.meta,
          state: view.state,
        });

        const savedCausation = await manager
          .getRepository(handlerOptions.postgres.causationEntity)
          .save({
            view_id: view.id,
            view_name: view.name,
            view_context: view.context,
            causation_id: causation.id,
          });

        this.logger.debug("Saved view", {
          savedCausation,
          savedView,
        });

        return new View(
          {
            ...view,
            causationList: [causation.id],
            revision: savedView.revision,
          },
          this.logger,
        );
      });
    } catch (err) {
      this.logger.error("Failed to insert view", err);

      throw err;
    }
  }

  private async update(
    view: ViewData,
    causation: IMessage,
    handlerOptions: ViewStoreHandlerOptions,
  ): Promise<View> {
    await this.promise();

    this.logger.debug("Updating view", {
      view,
      causation,
      handlerOptions,
    });

    try {
      return await this.connection.transaction<View>(async (manager) => {
        const result = await manager.getRepository(handlerOptions.postgres.viewEntity).update(
          {
            id: view.id,
            name: view.name,
            context: view.context,
            revision: view.revision,
          },
          {
            destroyed: view.destroyed,
            meta: view.meta,
            state: view.state,
          },
        );

        const causationEntity = await manager
          .getRepository(handlerOptions.postgres.causationEntity)
          .save({
            view_id: view.id,
            view_name: view.name,
            view_context: view.context,
            causation_id: causation.id,
          });

        this.logger.debug("Updated view entity", {
          result,
          causation: causationEntity,
        });

        return new View(
          {
            ...view,
            causationList: [...view.causationList, causation.id],
            revision: view.revision + 1,
          },
          this.logger,
        );
      });
    } catch (err) {
      this.logger.error("Failed to update view", err);

      throw err;
    }
  }
}
