import { HandlerIdentifier } from "../handler";
import { IRedisConnection } from "@lindorm-io/redis";
import { ViewRepositoryData } from "./view-repository";

export interface RedisViewRepositoryOptions {
  connection: IRedisConnection;
  view: HandlerIdentifier;
}

export interface IRedisRepository<S> {
  find(filter?: Partial<ViewRepositoryData<S>>): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S>>;
  findOne(filter: Partial<ViewRepositoryData<S>>): Promise<ViewRepositoryData<S>>;
}
