import { Filter, FindOptions } from "mongodb";
import { State } from "../generic";
import { ViewRepositoryData } from "./view-repository";
import { ViewStoreAttributes } from "../view-store";

export interface IMongoRepository<TState = State> {
  find(
    filter?: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<Array<ViewRepositoryData<TState>>>;
  findById(id: string): Promise<ViewRepositoryData<TState>>;
  findOne(
    find: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<ViewRepositoryData<TState>>;
}
