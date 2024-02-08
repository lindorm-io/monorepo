import { State } from "../generic";
import { ViewStoreAttributes } from "../view-store";
import { ViewRepositoryData } from "./view-repository";

export interface IRedisRepository<TState extends State = State> {
  find(filter?: Partial<ViewStoreAttributes>): Promise<Array<ViewRepositoryData<TState>>>;
  findById(id: string): Promise<ViewRepositoryData<TState> | undefined>;
  findOne(filter?: Partial<ViewStoreAttributes>): Promise<ViewRepositoryData<TState> | undefined>;
}
