import { Collection, Filter, FindOptions } from "mongodb";
import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { getViewStoreName } from "../../util";
import {
  HandlerIdentifier,
  IMongoRepository,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";

const projection: Partial<Record<keyof ViewStoreAttributes, number>> & { _id: 0 } = {
  _id: 0,
  id: 1,
  revision: 1,
  state: 1,
  created_at: 1,
  updated_at: 1,
};

export class MongoViewRepository<TState = State>
  extends MongoBase
  implements IMongoRepository<TState>
{
  private readonly collection: Collection<ViewStoreAttributes>;

  public constructor(connection: IMongoConnection, view: HandlerIdentifier, logger: Logger) {
    super(connection, logger);

    this.collection = this.connection?.database?.collection<ViewStoreAttributes>(
      getViewStoreName(view),
    );
  }

  public async find(
    filter: Filter<ViewStoreAttributes> = {},
    options: FindOptions<ViewStoreAttributes> = {},
  ): Promise<Array<ViewRepositoryData<TState>>> {
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

      const array: Array<ViewRepositoryData<TState>> = [];
      for (const item of result) {
        array.push({
          id: item.id,
          state: item.state as TState,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }

      return array;
    } catch (err) {
      this.logger.error("Failed to find views", err);

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState>> {
    this.logger.debug("Finding view", { id });

    try {
      const result = await this.collection.findOne({ id, destroyed: false }, { projection });

      if (!result) {
        this.logger.debug("View not found");

        return null;
      }

      this.logger.debug("Found view", { result });

      return {
        id: result.id,
        state: result.state as TState,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async findOne(
    filter: Filter<ViewStoreAttributes>,
    options: FindOptions<ViewStoreAttributes> = {},
  ): Promise<ViewRepositoryData<TState>> {
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

        return null;
      }

      this.logger.debug("Found view", { result });

      return {
        id: result.id,
        state: result.state as TState,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }
}
