import { Cache } from "../entity";
import { CacheData, CacheIdentifier } from "./cache";
import { Logger } from "@lindorm-io/winston";
import { Message } from "../message";
import { RedisConnection } from "@lindorm-io/redis";
import { State } from "./generic";

export type CacheStoreAttributes<S extends State = State> = CacheData<S>;

export interface CacheStoreOptions {
  connection: RedisConnection;
  logger: Logger;
}

export interface ICacheStore {
  save(cache: Cache, causation: Message): Promise<Cache>;
  load(cacheIdentifier: CacheIdentifier): Promise<Cache>;
}
