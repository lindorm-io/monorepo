import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Dict } from "@lindorm/types";
import { Collection, Filter, FindOptions } from "mongodb";
import { IMongoViewRepository } from "../../interfaces";
import { HandlerIdentifier, ViewRepositoryData, ViewStoreAttributes } from "../../types";
import { getViewStoreName } from "../../utils/private";
import { MongoBase } from "./MongoBase";

const projection: Partial<Record<keyof ViewStoreAttributes, number>> & { _id: 0 } = {
  _id: 0,
  id: 1,
  revision: 1,
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
    filter: Filter<ViewStoreAttributes> = {},
    options: FindOptions<ViewStoreAttributes> = {},
  ): Promise<Array<ViewRepositoryData<S>>> {
    this.logger.debug("Finding views", { filter, options });

    try {
      const cursor = this.collection.find(
        {
          destroyed: false,
          ...filter,
        },
        { projection, ...options },
      );
      const result = await cursor.toArray();

      this.logger.debug("Found views", { result });

      const array: Array<ViewRepositoryData<S>> = [];
      for (const item of result) {
        array.push({
          id: item.id,
          state: item.state as S,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }

      return array;
    } catch (err: any) {
      this.logger.error("Failed to find views", err);

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<S> | undefined> {
    this.logger.debug("Finding view", { id });

    try {
      const result = await this.collection.findOne(
        { id, destroyed: false },
        { projection },
      );

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

  public async findOne(
    filter: Filter<ViewStoreAttributes>,
    options: FindOptions<ViewStoreAttributes> = {},
  ): Promise<ViewRepositoryData<S> | undefined> {
    this.logger.debug("Finding view", {
      filter,
      options,
    });

    try {
      const result = await this.collection.findOne(
        { ...filter, destroyed: false },
        { ...options, projection },
      );

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
