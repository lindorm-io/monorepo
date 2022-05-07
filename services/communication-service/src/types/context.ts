import { IssuerVerifyData, TokenIssuer } from "@lindorm-io/jwt";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { KoaContext } from "@lindorm-io/koa";
import { RedisConnection } from "@lindorm-io/redis";

export interface Context<Body = Record<string, any>> extends KoaContext<Body> {
  cache: {
    keyPairCache: KeyPairCache;
  };
  connection: {
    redis: RedisConnection;
  };
  jwt: TokenIssuer;
  keys: Array<KeyPair>;
  keystore: Keystore;
  token: {
    bearerToken: IssuerVerifyData<never, never>;
  };
}
