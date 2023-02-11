import { Axios } from "@lindorm-io/axios";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
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
  oidcSessionToken: JwtDecodeData;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  token: ServerToken;
};

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
