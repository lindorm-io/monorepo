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
import { ChallengeConfirmationTokenClaims } from "../common";
import {
  ChallengeSession,
  Client,
  DeviceLink,
  EnrolmentSession,
  PublicKey,
  RdcSession,
} from "../entity";
import {
  ChallengeSessionCache,
  ClientRepository,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  PublicKeyRepository,
  RdcSessionCache,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  communicationClient: Axios;
  oauthClient: Axios;
  vaultClient: Axios;
}

interface ServerEntity {
  challengeSession: ChallengeSession;
  client: Client;
  deviceLink: DeviceLink;
  enrolmentSession: EnrolmentSession;
  publicKey: PublicKey;
  rdcSession: RdcSession;
}

interface ServerMongo extends LindormNodeServerMongo {
  clientRepository: ClientRepository;
  deviceLinkRepository: DeviceLinkRepository;
  publicKeyRepository: PublicKeyRepository;
}

interface ServerRedis extends LindormNodeServerRedis {
  challengeSessionCache: ChallengeSessionCache;
  rdcSessionCache: RdcSessionCache;
  enrolmentSessionCache: EnrolmentSessionCache;
}

interface ServerToken extends LindormNodeServerToken {
  challengeConfirmationToken: JwtVerify<ChallengeConfirmationTokenClaims>;
  challengeSessionToken: JwtVerify;
  rdcSessionToken: JwtVerify<Record<string, any>>;
  enrolmentSessionToken: JwtVerify;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: ServerMongo;
  redis: ServerRedis;
  token: ServerToken;
}

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
