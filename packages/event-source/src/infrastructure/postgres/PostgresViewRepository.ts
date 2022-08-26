import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm";
import { ILogger } from "@lindorm-io/winston";
import { PostgresBase } from "./PostgresBase";
import { ViewEntity } from "./entity";
import {
  HandlerIdentifier,
  IPostgresRepository,
  State,
  PostgresViewRepositoryOptions,
  ViewRepositoryData,
} from "../../types";

export class PostgresViewRepository<TState = State>
  extends PostgresBase
  implements IPostgresRepository<TState>
{
  private readonly ViewEntity: typeof ViewEntity;
  private readonly viewIdentifier: HandlerIdentifier;

  public constructor(options: PostgresViewRepositoryOptions, logger: ILogger) {
    super(options.connection, logger);

    this.ViewEntity = options.ViewEntity;
    this.viewIdentifier = options.view;
  }

  public async find(
    filter: FindManyOptions<ViewEntity>,
  ): Promise<Array<ViewRepositoryData<TState>>> {
    this.logger.debug("Finding views", { filter });

    const { select: _, ...options } = filter;

    try {
      const entities = await this.connection.getRepository(this.ViewEntity).find({
        select: {
          id: true,
          modified: true,
          revision: true,
          created_at: true,
          updated_at: true,
          // @ts-ignore
          state: true,
        },
        where: {
          destroyed: false,
          ...(options.where || {}),
        },
        ...options,
      });

      this.logger.debug("Found views", { entities });

      const array: Array<ViewRepositoryData<TState>> = [];
      for (const item of entities) {
        array.push({
          id: item.id,
          name: this.viewIdentifier.name,
          context: this.viewIdentifier.context,
          modified: item.modified,
          revision: item.revision,
          state: item.state as TState,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }

      return array;
    } catch (err) {
      this.logger.error("Failed to find views", err);
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState>> {
    this.logger.debug("Finding view", { id });

    try {
      return this.findOne({ where: { id, destroyed: false } });
    } catch (err) {
      this.logger.error("Failed to find view", err);
    }
  }

  public async findOne(filter: FindOneOptions<ViewEntity>): Promise<ViewRepositoryData<TState>> {
    this.logger.debug("Finding view", { filter });

    const { select: _, ...options } = filter;

    try {
      const entity = await this.connection.getRepository(this.ViewEntity).findOne({
        select: {
          id: true,
          modified: true,
          revision: true,
          created_at: true,
          updated_at: true,
          // @ts-ignore
          state: true,
        },
        where: {
          destroyed: false,
          ...(options.where || {}),
        },
        ...options,
      });

      if (!entity) {
        this.logger.debug("View not found");

        return null;
      }

      this.logger.debug("Found view", { entity });

      return {
        id: entity.id,
        name: this.viewIdentifier.name,
        context: this.viewIdentifier.context,
        modified: entity.modified,
        revision: entity.revision,
        state: entity.state as TState,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);
    }
  }
}
