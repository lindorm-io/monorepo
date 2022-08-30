import { State } from "../generic";
import { ViewRepositoryData } from "./view-repository";

export interface IPostgresRepository<TState = State> {
  find(filter: any): Promise<Array<ViewRepositoryData<TState>>>;
  findById(id: string): Promise<ViewRepositoryData<TState>>;
  findOne(filter: any): Promise<ViewRepositoryData<TState>>;
}
