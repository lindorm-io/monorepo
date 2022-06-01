import { Axios } from "@lindorm-io/axios";
import { IssuerVerifyData } from "@lindorm-io/jwt";
import { Controller } from "@lindorm-io/koa";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerToken,
} from "@lindorm-io/node-server";
import { OidcSession } from "../entity";
import { OidcSessionCache } from "../infrastructure";

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
  oidcSessionToken: IssuerVerifyData<never, never>;
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
