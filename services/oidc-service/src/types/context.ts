import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
import { OidcSession } from "../entity";
import { OidcSessionCache } from "../infrastructure";
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

interface ServerAxios extends LindormNodeServerAxios {
  identityClient: Axios;
  oauthClient: Axios;
}

interface ServerEntity {
  oidcSession: OidcSession;
}

interface ServerRedis extends LindormNodeServerRedis {
  oidcSessionCache: OidcSessionCache;
}

interface ServerToken extends LindormNodeServerToken {
  oidcSessionToken: JwtDecodeData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: LindormNodeServerMongo;
  redis: ServerRedis;
  token: ServerToken;
}

export interface ServerKoaContext<D extends Dict = Dict>
  extends LindormNodeServerKoaContext<Context, D> {}

export interface ServerKoaController<D extends Dict = Dict>
  extends Controller<ServerKoaContext<D>> {}

export interface ServerKoaMiddleware extends LindormNodeServerKoaMiddleware<ServerKoaContext> {}
