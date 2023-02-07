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

type ServerAxios = LindormNodeServerAxios & {
  identityClient: Axios;
  oauthClient: Axios;
};

type ServerCache = LindormNodeServerCache & {
  oidcSessionCache: OidcSessionCache;
};

type ServerEntity = {
  oidcSession: OidcSession;
};

type ServerToken = LindormNodeServerToken & {
  oidcSessionToken: JwtVerifyData;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  token: ServerToken;
};

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
