import { Axios } from "@lindorm-io/axios";
import { Address, DisplayName, Identifier, Identity } from "../entity";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import {
  LindormNodeServerAxios,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerMemory,
  LindormNodeServerMongo,
  LindormNodeServerRedis,
} from "@lindorm-io/node-server";
import {
  AddressRepository,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  oauthClient: Axios;
}

interface ServerEntity {
  address: Address;
  displayName: DisplayName;
  identifier: Identifier;
  identity: Identity;
}

interface ServerMongo extends LindormNodeServerMongo {
  addressRepository: AddressRepository;
  displayNameRepository: DisplayNameRepository;
  identifierRepository: IdentifierRepository;
  identityRepository: IdentityRepository;
}

interface ServerRedis extends LindormNodeServerRedis {}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: ServerMongo;
  redis: ServerRedis;
}

export interface ServerKoaContext<D extends Dict = Dict>
  extends LindormNodeServerKoaContext<Context, D> {}

export interface ServerKoaController<D extends Dict = Dict>
  extends Controller<ServerKoaContext<D>> {}

export interface ServerKoaMiddleware extends LindormNodeServerKoaMiddleware<ServerKoaContext> {}
