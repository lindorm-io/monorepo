import { KoaContext } from "@lindorm-io/koa";
import { KeyPairCache, KeyPairRepository } from "../infrastructure";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";

export interface KeystoreContext extends KoaContext {
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
