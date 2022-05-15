import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { KeyPairCache, KeyPairRepository } from "../infrastructure";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
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
  cache: {
    keyPairCache: KeyPairCache;
  };
  repository: {
    keyPairRepository: KeyPairRepository;
  };
}

export type DefaultLindormKeystoreKoaMiddleware = DefaultLindormMiddleware<
  DefaultLindormKoaContext<DefaultLindormKeystoreContext>
>;

export type DefaultLindormKeystoreSocketMiddleware = DefaultLindormSocketMiddleware<
  DefaultLindormSocket<DefaultLindormKeystoreContext>
>;
