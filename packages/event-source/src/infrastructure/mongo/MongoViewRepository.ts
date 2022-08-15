import { Filter, FindOptions } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { MongoBase } from "./MongoBase";
import { MongoViewStore } from "./MongoViewStore";
import {
  IMongoRepository,
  MongoViewRepositoryOptions,
  MongoViewStoreAttributes,
  State,
  ViewRepositoryData,
} from "../../types";

const projection: Partial<Record<keyof MongoViewStoreAttributes, number>> & { _id: 0 } = {
  _id: 0,
  id: 1,
  name: 1,
  context: 1,
  revision: 1,
  state: 1,
  created_at: 1,
  updated_at: 1,
};

export class MongoViewRepository<S = State>
  extends MongoBase<MongoViewStoreAttributes>
  implements IMongoRepository<S>
{
  public constructor(options: MongoViewRepositoryOptions, logger: ILogger) {
    super(
      {
        connection: options.connection,
        collection: options.collection || MongoViewStore.getCollectionName(options.view),
      },
      logger,
    );
  }

  public async find(
    filter: Filter<MongoViewStoreAttributes> = {},
    options: FindOptions<MongoViewStoreAttributes> = {},
  ): Promise<Array<ViewRepositoryData<S>>> {
    await this.promise();

    this.logger.debug("Finding views", { filter, options });

    try {
      const cursor = this.collection.find<MongoViewStoreAttributes>(
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

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<S>> {
    this.logger.debug("Finding view", { id });

    await this.promise();

    try {
      const result = await this.collection.findOne({ id, destroyed: false }, { projection });

      if (!result) {
        this.logger.debug("View not found");

        return null;
      }

      this.logger.debug("Found view", { result });

      return {
        id: result.id,
        name: result.name,
        context: result.context,
        revision: result.revision,
        state: result.state as S,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }

  public async findOne(
    filter: Filter<MongoViewStoreAttributes>,
    options: FindOptions<MongoViewStoreAttributes> = {},
  ): Promise<ViewRepositoryData<S>> {
    this.logger.debug("Finding view", {
      filter,
      options,
    });

    await this.promise();

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
        name: result.name,
        context: result.context,
        revision: result.revision,
        state: result.state as S,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (err) {
      this.logger.error("Failed to find view", err);

      throw err;
    }
  }
}
