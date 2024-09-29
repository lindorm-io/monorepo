import { Dict } from "@lindorm/types";
import { Filter, FindOptions } from "mongodb";
import {
  PostgresViewRepositoryFindFilter,
  PostgresViewRepositoryFindOneFilter,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../types";

export interface IMongoViewRepository<S extends Dict = Dict> {
  find(
    filter?: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S> | undefined>;
  findOne(
    find: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<ViewRepositoryData<S> | undefined>;
}

export interface IPostgresViewRepository<S extends Dict = Dict> {
  find(filter?: PostgresViewRepositoryFindFilter): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S> | undefined>;
  findOne(
    filter: PostgresViewRepositoryFindOneFilter,
  ): Promise<ViewRepositoryData<S> | undefined>;
}

export interface IRedisViewRepository<S extends Dict = Dict> {
  find(filter?: Partial<ViewStoreAttributes>): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S> | undefined>;
  findOne(
    filter?: Partial<ViewStoreAttributes>,
  ): Promise<ViewRepositoryData<S> | undefined>;
}
