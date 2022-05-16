import { Axios } from "@lindorm-io/axios";
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
  ConnectSession,
  DisplayName,
  Email,
  Identity,
  ExternalIdentifier,
  PhoneNumber,
} from "../entity";
import {
  ConnectSessionCache,
  DisplayNameRepository,
  EmailRepository,
  ExternalIdentifierRepository,
  IdentityRepository,
  PhoneNumberRepository,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  communicationClient: Axios;
  oauthClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  connectSessionCache: ConnectSessionCache;
}

interface ServerEntity {
  connectSession: ConnectSession;
  displayName: DisplayName;
  email: Email;
  externalIdentifier: ExternalIdentifier;
  identity: Identity;
  phoneNumber: PhoneNumber;
}

interface ServerRepository extends LindormNodeServerRepository {
  displayNameRepository: DisplayNameRepository;
  emailRepository: EmailRepository;
  externalIdentifierRepository: ExternalIdentifierRepository;
  identityRepository: IdentityRepository;
  phoneNumberRepository: PhoneNumberRepository;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
}

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
