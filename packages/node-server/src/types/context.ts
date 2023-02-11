import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData, JWT } from "@lindorm-io/jwt";
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
  bearerToken: JwtDecodeData;
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
  C extends LindormNodeServerContext = LindormNodeServerContext,
  D extends Dict = Dict,
> = DefaultLindormKoaContext<C, D>;

export type LindormNodeServerKoaMiddleware<
  C extends LindormNodeServerKoaContext = LindormNodeServerKoaContext,
> = DefaultLindormMiddleware<C>;

export type LindormNodeServerSocketMiddleware<
  S extends DefaultLindormSocket = DefaultLindormSocket,
> = DefaultLindormSocketMiddleware<S>;
