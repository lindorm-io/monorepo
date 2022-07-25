import { HandlerIdentifier } from "./handler";
import { Logger } from "@lindorm-io/winston";
import { RedisConnection } from "@lindorm-io/redis";

export interface CacheRepositoryOptions {
  cache: HandlerIdentifier;
  connection: RedisConnection;
  logger: Logger;
}

export interface CacheRepositoryData<S> {
  id: string;
  revision: number;
  state: S;
}
