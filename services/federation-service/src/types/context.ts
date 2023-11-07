import { Axios } from "@lindorm-io/axios";
import { Dict } from "@lindorm-io/common-types";
import { JwtVerify } from "@lindorm-io/jwt";
import { Controller } from "@lindorm-io/koa";
import {
  LindormNodeServerAxios,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerMemory,
  LindormNodeServerMongo,
  LindormNodeServerRedis,
  LindormNodeServerToken,
} from "@lindorm-io/node-server";
import { FederationSession } from "../entity";
import { FederationSessionCache } from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  identityClient: Axios;
  oauthClient: Axios;
}

interface ServerEntity {
  federationSession: FederationSession;
}

interface ServerRedis extends LindormNodeServerRedis {
  federationSessionCache: FederationSessionCache;
}

interface ServerToken extends LindormNodeServerToken {
  federationSessionToken: JwtVerify;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: LindormNodeServerMongo;
  redis: ServerRedis;
  token: ServerToken;
}

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
