import { Axios } from "@lindorm-io/axios";
import { DisplayName, Identity, Identifier, Address } from "../entity";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerRepository,
} from "@lindorm-io/node-server";
import {
  AddressRepository,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";

type ServerAxios = LindormNodeServerAxios & {
  oauthClient: Axios;
};

type ServerCache = LindormNodeServerCache;

type ServerEntity = {
  address: Address;
  displayName: DisplayName;
  identifier: Identifier;
  identity: Identity;
};

type ServerRepository = LindormNodeServerRepository & {
  addressRepository: AddressRepository;
  displayNameRepository: DisplayNameRepository;
  identifierRepository: IdentifierRepository;
  identityRepository: IdentityRepository;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
};

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
