import { Filter, FindOptions } from "mongodb";
import { MongoBase } from "./MongoBase";
import { ViewRepositoryData, ViewRepositoryOptions, ViewStoreAttributes } from "../types";
import { ViewStore } from "./ViewStore";

export class ViewRepository<S> extends MongoBase<ViewStoreAttributes> {
  private readonly filter: Filter<ViewStoreAttributes>;
  private readonly options: FindOptions;

  public constructor(options: ViewRepositoryOptions) {
    super({
      ...options,
      collection: options.collection || ViewStore.getCollectionName(options.view),
    });

    this.filter = { ...options.view, destroyed: false };
    this.options = {
      projection: {
        _id: 0,
        id: 1,
        revision: 1,
        state: 1,
        timeModified: 1,
      },
    };
  }

  public async count(
    findFilter: Filter<ViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<number> {
    const start = Date.now();

    const filter = { ...this.filter, ...findFilter };

    this.logger.debug("Counting View data", {
      filter,
      options: findOptions,
    });

    await this.promise();

    try {
      const amount = await this.collection.countDocuments(filter, findOptions);

      this.logger.debug("Returning View amount", {
        amount,
        time: Date.now() - start,
      });

      return amount;
    } catch (err) {
      this.logger.error("Failed to count View data", err);

      throw err;
    }
  }

  public async find(
    findFilter: Filter<ViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Array<ViewRepositoryData<S>>> {
    const start = Date.now();

    const filter = { ...this.filter, ...findFilter };
    const options = { ...this.options, ...findOptions };

    this.logger.debug("Finding View data", {
      filter,
      options,
    });

    await this.promise();

    try {
      const cursor = await this.collection.find(filter, options);
      const result = await cursor.toArray();

      this.logger.debug("Returning View data", {
        result,
        time: Date.now() - start,
      });

      return result.map((item) => ({
        id: item.id,
        revision: item.revision,
        state: item.state as S,
        timeModified: item.timeModified,
      }));
    } catch (err) {
      this.logger.error("Failed to find View data", err);

      throw err;
    }
  }

  public async findOne(
    findFilter: Filter<ViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<ViewRepositoryData<S>> {
    const start = Date.now();

    const filter = { ...this.filter, ...findFilter };
    const options = { ...this.options, ...findOptions };

    this.logger.debug("Finding View data", {
      filter,
      options,
    });

    await this.promise();

    try {
      const result = await this.collection.findOne(filter, options);

      if (!result) {
        this.logger.debug("Returning null", {
          result,
          time: Date.now() - start,
        });

        return null;
      }

      this.logger.debug("Returning View data", {
        result,
        time: Date.now() - start,
      });

      return {
        id: result.id,
        revision: result.revision,
        state: result.state as S,
        timeModified: result.timeModified,
      };
    } catch (err) {
      this.logger.error("Failed to find View data", err);

      throw err;
    }
  }
}
