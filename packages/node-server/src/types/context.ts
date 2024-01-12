import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { JWT, JwtVerify } from "@lindorm-io/jwt";
import { Keystore } from "@lindorm-io/keystore";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
  IOServer,
} from "@lindorm-io/koa";
import {
  StoredKeySetMemoryCache,
  StoredKeySetMongoRepository,
  StoredKeySetRedisRepository,
} from "@lindorm-io/koa-keystore";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { WebKeySet } from "../../../jwk/dist";

export interface LindormNodeServerAxios {
  axiosClient: Axios;
}

export interface LindormNodeServerConnection {
  io: IOServer;
  mongo: MongoConnection;
  redis: RedisConnection;
}

export interface LindormNodeServerMemory {
  storedKeySetMemoryCache: StoredKeySetMemoryCache;
}

export interface LindormNodeServerMongo {
  storedKeySetMongoRepository: StoredKeySetMongoRepository;
}

export interface LindormNodeServerRedis {
  storedKeySetRedisRepository: StoredKeySetRedisRepository;
}

export interface LindormNodeServerToken {
  bearerToken: JwtVerify;
}

export interface LindormNodeServerContext extends DefaultLindormContext {
  axios: LindormNodeServerAxios;
  connection: LindormNodeServerConnection;
  jwt: JWT;
  keys: Array<WebKeySet>;
  keystore: Keystore;
  memory: LindormNodeServerMemory;
  mongo: LindormNodeServerMongo;
  redis: LindormNodeServerRedis;
  token: LindormNodeServerToken;
}

export type LindormNodeServerKoaContext<
  C extends LindormNodeServerContext = LindormNodeServerContext,
  D extends Dict = Dict,
> = DefaultLindormKoaContext<C, D>;

export type LindormNodeServerKoaMiddleware<
  C extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> = DefaultLindormMiddleware<C>;

export type LindormNodeServerSocketMiddleware<
  S extends DefaultLindormSocket = DefaultLindormSocket,
> = DefaultLindormSocketMiddleware<S>;
