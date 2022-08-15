import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm";
import { ILogger } from "@lindorm-io/winston";
import { PostgresBase } from "./PostgresBase";
import { ViewEntity } from "./entity";
import {
  IPostgresRepository,
  PostgresViewRepositoryOptions,
  State,
  ViewRepositoryData,
} from "../../types";

export class PostgresViewRepository<S = State>
  extends PostgresBase
  implements IPostgresRepository<S>
{
  private readonly entity: typeof ViewEntity;

  public constructor(options: PostgresViewRepositoryOptions, logger: ILogger) {
    super(options.connection, logger);

    this.entity = options.viewEntity;
  }

  public async find(filter: FindManyOptions<ViewEntity>): Promise<Array<ViewRepositoryData<S>>> {
    await this.promise();

    this.logger.debug("Finding views", { filter });

    const { select: _, ...options } = filter;

    try {
      const entities = await this.connection.getRepository(this.entity).find({
        select: {
          id: true,
          name: true,
          context: true,
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

      const array: Array<ViewRepositoryData<S>> = [];
      for (const item of entities) {
        array.push({
          id: item.id,
          name: item.name,
          context: item.context,
          revision: item.revision,
          state: item.state as S,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }

      return array;
    } catch (err) {
      this.logger.error("Failed to find views", err);
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<S>> {
    await this.promise();

    this.logger.debug("Finding view", { id });

    try {
      return this.findOne({ where: { id, destroyed: false } });
    } catch (err) {
      this.logger.error("Failed to find view", err);
    }
  }

  public async findOne(filter: FindOneOptions<ViewEntity>): Promise<ViewRepositoryData<S>> {
    await this.promise();

    this.logger.debug("Finding view", { filter });

    const { select: _, ...options } = filter;

    try {
      const entity = await this.connection.getRepository(this.entity).findOne({
        select: {
          id: true,
          name: true,
          context: true,
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
        name: entity.name,
        context: entity.context,
        revision: entity.revision,
        state: entity.state as S,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);
    }
  }
}
