import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { JWT, JwtDecodeData } from "@lindorm-io/jwt";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
  IOServer,
} from "@lindorm-io/koa";
import {
  KeyPairMemoryCache,
  KeyPairMongoRepository,
  KeyPairRedisRepository,
} from "@lindorm-io/koa-keystore";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";

export interface LindormNodeServerAxios {
  axiosClient: Axios;
}

export interface LindormNodeServerConnection {
  io: IOServer;
  mongo: MongoConnection;
  redis: RedisConnection;
}

export interface LindormNodeServerMemory {
  keyPairMemoryCache: KeyPairMemoryCache;
}

export interface LindormNodeServerMongo {
  keyPairMongoRepository: KeyPairMongoRepository;
}

export interface LindormNodeServerRedis {
  keyPairRedisRepository: KeyPairRedisRepository;
}

export interface LindormNodeServerToken {
  bearerToken: JwtDecodeData<never>;
}

export interface LindormNodeServerContext extends DefaultLindormContext {
  axios: LindormNodeServerAxios;
  connection: LindormNodeServerConnection;
  jwt: JWT;
  keys: Array<KeyPair>;
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
