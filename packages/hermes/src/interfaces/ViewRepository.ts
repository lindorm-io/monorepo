import { Dict } from "@lindorm/types";
import {
  MongoFindCriteria,
  MongoFindOptions,
  PostgresFindCriteria,
  PostgresFindOptions,
  RedisFindCriteria,
  ViewRepositoryAttributes,
} from "../types";

export interface IMongoViewRepository<S extends Dict = Dict> {
  find(
    criteria?: MongoFindCriteria<S>,
    options?: MongoFindOptions<S>,
  ): Promise<Array<ViewRepositoryAttributes<S>>>;
  findById(id: string): Promise<ViewRepositoryAttributes<S> | undefined>;
  findOne(
    criteria: MongoFindCriteria<S>,
    options?: MongoFindOptions<S>,
  ): Promise<ViewRepositoryAttributes<S> | undefined>;
}

export interface IPostgresViewRepository<S extends Dict = Dict> {
  find(
    criteria?: PostgresFindCriteria<S>,
    options?: PostgresFindOptions<S>,
  ): Promise<Array<ViewRepositoryAttributes<S>>>;
  findById(id: string): Promise<ViewRepositoryAttributes<S> | undefined>;
  findOne(
    criteria: PostgresFindCriteria<S>,
    options?: PostgresFindOptions<S>,
  ): Promise<ViewRepositoryAttributes<S> | undefined>;
}

export interface IRedisViewRepository<S extends Dict = Dict> {
  find(criteria?: RedisFindCriteria<S>): Promise<Array<ViewRepositoryAttributes<S>>>;
  findById(id: string): Promise<ViewRepositoryAttributes<S> | undefined>;
  findOne(
    criteria?: RedisFindCriteria<S>,
  ): Promise<ViewRepositoryAttributes<S> | undefined>;
}
