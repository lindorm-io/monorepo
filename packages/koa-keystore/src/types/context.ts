import { WebKeySet } from "@lindorm-io/jwk";
import { Keystore } from "@lindorm-io/keystore";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import {
  StoredKeySetMemoryCache,
  StoredKeySetMongoRepository,
  StoredKeySetRedisRepository,
} from "../infrastructure";

export interface DefaultLindormKeystoreContext extends DefaultLindormContext {
  connection: {
    mongo: MongoConnection;
    redis: RedisConnection;
  };
  keys: Array<WebKeySet>;
  keystore: Keystore;
  memory: {
    storedKeySetMemoryCache: StoredKeySetMemoryCache;
  };
  mongo: {
    storedKeySetMongoRepository: StoredKeySetMongoRepository;
  };
  redis: {
    storedKeySetRedisRepository: StoredKeySetRedisRepository;
  };
}

export type DefaultLindormKeystoreKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormKeystoreContext>
>;

export type DefaultLindormKeystoreSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormKeystoreContext>
>;
