import { Axios } from "@lindorm-io/axios";
import { ConnectSession, DisplayName, Identity, Identifier, Address } from "../entity";
import { Controller } from "@lindorm-io/koa";
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
  ConnectSessionCache,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";

type ServerAxios = LindormNodeServerAxios & {
  communicationClient: Axios;
  oauthClient: Axios;
};

type ServerCache = LindormNodeServerCache & {
  connectSessionCache: ConnectSessionCache;
};

type ServerEntity = {
  address: Address;
  connectSession: ConnectSession;
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

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
