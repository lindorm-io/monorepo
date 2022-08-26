import { Filter, FindOptions } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { MongoBase } from "./MongoBase";
import { MongoViewStore } from "./MongoViewStore";
import {
  HandlerIdentifier,
  IMongoRepository,
  MongoViewRepositoryOptions,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";

const projection: Partial<Record<keyof ViewStoreAttributes, number>> & { _id: 0 } = {
  _id: 0,
  id: 1,
  modified: 1,
  revision: 1,
  state: 1,
  created_at: 1,
  updated_at: 1,
};

export class MongoViewRepository<TState = State>
  extends MongoBase
  implements IMongoRepository<TState>
{
  private readonly collectionName: string;
  private readonly viewIdentifier: HandlerIdentifier;

  public constructor(options: MongoViewRepositoryOptions, logger: ILogger) {
    super(options.connection, logger);

    this.collectionName = MongoViewStore.getCollectionName(options.view);
    this.viewIdentifier = options.view;
  }

  public async find(
    filter: Filter<ViewStoreAttributes> = {},
    options: FindOptions<ViewStoreAttributes> = {},
  ): Promise<Array<ViewRepositoryData<TState>>> {
    const collection = this.connection.database.collection<ViewStoreAttributes>(
      this.collectionName,
    );

    this.logger.debug("Finding views", { filter, options });

    try {
      const cursor = collection.find<ViewStoreAttributes>(
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

      throw err;
    }
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState>> {
    const collection = this.connection.database.collection<ViewStoreAttributes>(
      this.collectionName,
    );

    this.logger.debug("Finding view", { id });

    try {
      const result = await collection.findOne({ id, destroyed: false }, { projection });

      if (!result) {
        this.logger.debug("View not found");

        return null;
      }

      this.logger.debug("Found view", { result });

      return {
        id: result.id,
        name: this.viewIdentifier.name,
        context: this.viewIdentifier.context,
        modified: result.modified,
        revision: result.revision,
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
    const collection = this.connection.database.collection<ViewStoreAttributes>(
      this.collectionName,
    );

    this.logger.debug("Finding view", {
      filter,
      options,
    });

    try {
      const result = await collection.findOne(
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
        name: this.viewIdentifier.name,
        context: this.viewIdentifier.context,
        modified: result.modified,
        revision: result.revision,
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
