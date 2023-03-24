import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import {
  KeyPairMemoryCache,
  KeyPairMongoRepository,
  KeyPairRedisRepository,
} from "../infrastructure";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "@lindorm-io/koa";

export interface DefaultLindormKeystoreContext extends DefaultLindormContext {
  connection: {
    mongo: MongoConnection;
    redis: RedisConnection;
  };
  keys: Array<KeyPair>;
  keystore: Keystore;
  memory: {
    keyPairMemoryCache: KeyPairMemoryCache;
  };
  mongo: {
    keyPairMongoRepository: KeyPairMongoRepository;
  };
  redis: {
    keyPairRedisRepository: KeyPairRedisRepository;
  };
}

export type DefaultLindormKeystoreKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormKeystoreContext>
>;

export type DefaultLindormKeystoreSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormKeystoreContext>
>;
