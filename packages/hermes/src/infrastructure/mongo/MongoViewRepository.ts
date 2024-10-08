import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Dict } from "@lindorm/types";
import { Collection, Filter } from "mongodb";
import { IMongoViewRepository } from "../../interfaces";
import {
  HandlerIdentifier,
  MongoFindCriteria,
  MongoFindOptions,
  ViewRepositoryAttributes,
  ViewStoreAttributes,
} from "../../types";
import { getViewStoreName } from "../../utils/private";
import { MongoBase } from "./MongoBase";

const projection: Partial<Record<keyof ViewStoreAttributes, number>> & { _id: 0 } = {
  _id: 0,
  id: 1,
  state: 1,
  created_at: 1,
  updated_at: 1,
};

export class MongoViewRepository<S extends Dict = Dict>
  extends MongoBase
  implements IMongoViewRepository<S>
{
  private readonly collection: Collection<ViewStoreAttributes>;

  public constructor(
    source: IMongoSource,
    handlerIdentifier: HandlerIdentifier,
    logger: ILogger,
  ) {
    super(source, logger);

    this.collection = this.source?.collection<ViewStoreAttributes>(
      getViewStoreName(handlerIdentifier),
    );
  }

  public async find(
    criteria: MongoFindCriteria<S> = {},
    options: MongoFindOptions<S> = {},
  ): Promise<Array<ViewRepositoryAttributes<S>>> {
    this.logger.debug("Finding views", { criteria, options });

    try {
      const filter: Filter<ViewStoreAttributes> = {
        destroyed: false,
        ...(criteria as Dict),
      };

      const result = await this.collection
        .find(filter, { ...options, projection })
        .toArray();

      this.logger.debug("Found views", { result });

      return result.map((item) => ({
        id: item.id,
        state: item.state as S,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (err: any) {
      this.logger.error("Failed to find views", err);
      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryAttributes<S> | undefined> {
    return await this.findOne({ id });
  }

  public async findOne(
    criteria: MongoFindCriteria<S>,
    options: MongoFindOptions<S> = {},
  ): Promise<ViewRepositoryAttributes<S> | undefined> {
    this.logger.debug("Finding view", {
      criteria,
      options,
    });

    try {
      const filter: Filter<ViewStoreAttributes> = {
        destroyed: false,
        ...(criteria as Dict),
      };

      const result = await this.collection.findOne(filter, { projection });

      if (!result) {
        this.logger.debug("View not found");
        return;
      }

      this.logger.debug("Found view", { result });

      return {
        id: result.id,
        state: result.state as S,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (err: any) {
      this.logger.error("Failed to find view", err);
      throw err;
    }
  }
}
