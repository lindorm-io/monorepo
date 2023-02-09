import { Filter, FindOptions } from "mongodb";
import { IMongoRepository, State, ViewRepositoryData, ViewStoreAttributes } from "../../types";
import { LindormError } from "@lindorm-io/errors";

export class NoopMongoViewRepository implements IMongoRepository {
  public find(
    filter?: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<Array<ViewRepositoryData<State>>> {
    throw new LindormError("Mongo Connection not found");
  }

  public findById(id: string): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }

  public findOne(
    find: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }
}
