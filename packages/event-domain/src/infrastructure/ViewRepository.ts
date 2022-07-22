import { StoreBase } from "./StoreBase";
import { Filter, FindOptions } from "mongodb";
import { HandlerIdentifier, StoreBaseOptions, ViewIdentifier, ViewStoreAttributes } from "../types";

export interface ViewRepositoryOptions extends StoreBaseOptions {
  view: HandlerIdentifier;
}

export interface ViewRepositoryData<State> extends ViewIdentifier {
  destroyed: boolean;
  revision: number;
  state: State;
  timeModified: Date;
}

export class ViewRepository<State> extends StoreBase<ViewStoreAttributes> {
  private readonly filter: Record<string, any>;
  private readonly options: Record<string, any>;

  public constructor(options: ViewRepositoryOptions) {
    super(options);

    this.filter = { ...options.view, destroyed: false };
    this.options = {
      projection: {
        id: 1,
        destroyed: 1,
        revision: 1,
        state: 1,
        timeModified: 1,
      },
    };
  }

  public async find(
    findFilter: Filter<ViewStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Array<ViewRepositoryData<State>>> {
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
        destroyed: item.destroyed,
        revision: item.revision,
        state: item.state,
        timeModified: item.timeModified,
      })) as Array<ViewRepositoryData<State>>;
    } catch (err) {
      this.logger.error("Failed to find View data", err);

      throw err;
    }
  }
}
