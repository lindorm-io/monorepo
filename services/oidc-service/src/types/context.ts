import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { JwtVerifyData } from "@lindorm-io/jwt";
import { OidcSession } from "../entity";
import { OidcSessionCache } from "../infrastructure";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerToken,
} from "@lindorm-io/node-server";

interface ServerAxios extends LindormNodeServerAxios {
  identityClient: Axios;
  oauthClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  oidcSessionCache: OidcSessionCache;
}

interface ServerEntity {
  oidcSession: OidcSession;
}

interface ServerToken extends LindormNodeServerToken {
  oidcSessionToken: JwtVerifyData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  token: ServerToken;
}

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
