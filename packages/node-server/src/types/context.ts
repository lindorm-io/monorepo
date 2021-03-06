import { Axios } from "@lindorm-io/axios";
import { JwtVerifyData, JWT } from "@lindorm-io/jwt";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { KeyPairCache, KeyPairRepository } from "@lindorm-io/koa-keystore";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import {
  DefaultLindormContext,
  DefaultLindormKoaContext,
  DefaultLindormMiddleware,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
  IOServer,
} from "@lindorm-io/koa";

export interface LindormNodeServerAxios {
  axiosClient: Axios;
}

export interface LindormNodeServerConnection {
  io: IOServer;
  mongo: MongoConnection;
  redis: RedisConnection;
}

export interface LindormNodeServerCache {
  keyPairCache: KeyPairCache;
}

export interface LindormNodeServerRepository {
  keyPairRepository: KeyPairRepository;
}

export interface LindormNodeServerToken {
  bearerToken: JwtVerifyData;
}

export interface LindormNodeServerContext extends DefaultLindormContext {
  axios: LindormNodeServerAxios;
  cache: LindormNodeServerCache;
  connection: LindormNodeServerConnection;
  jwt: JWT;
  keys: Array<KeyPair>;
  keystore: Keystore;
  repository: LindormNodeServerRepository;
  token: LindormNodeServerToken;
}

export type LindormNodeServerKoaContext<
  Context extends LindormNodeServerContext = LindormNodeServerContext,
  Data extends Record<string, any> = Record<string, any>,
> = DefaultLindormKoaContext<Context, Data>;

export type LindormNodeServerKoaMiddleware<
  Context extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> = DefaultLindormMiddleware<Context>;

export type LindormNodeServerSocketMiddleware<
  Socket extends DefaultLindormSocket = DefaultLindormSocket,
> = DefaultLindormSocketMiddleware<Socket>;
