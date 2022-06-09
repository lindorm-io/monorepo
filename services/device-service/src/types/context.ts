import { Axios } from "@lindorm-io/axios";
import { ChallengeSession, DeviceLink, EnrolmentSession, RdcSession } from "../entity";
import { Controller } from "@lindorm-io/koa";
import { JwtVerifyData } from "@lindorm-io/jwt";
import { VerifiedChallengeConfirmationToken } from "../common";
import {
  LindormNodeServerAxios,
  LindormNodeServerCache,
  LindormNodeServerContext,
  LindormNodeServerKoaContext,
  LindormNodeServerKoaMiddleware,
  LindormNodeServerRepository,
  LindormNodeServerToken,
} from "@lindorm-io/node-server";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../infrastructure";

interface ServerAxios extends LindormNodeServerAxios {
  communicationClient: Axios;
  oauthClient: Axios;
  vaultClient: Axios;
}

interface ServerCache extends LindormNodeServerCache {
  challengeSessionCache: ChallengeSessionCache;
  rdcSessionCache: RdcSessionCache;
  enrolmentSessionCache: EnrolmentSessionCache;
}

interface ServerEntity {
  challengeSession: ChallengeSession;
  deviceLink: DeviceLink;
  rdcSession: RdcSession;
  enrolmentSession: EnrolmentSession;
}

interface ServerRepository extends LindormNodeServerRepository {
  deviceLinkRepository: DeviceLinkRepository;
}

interface ServerToken extends LindormNodeServerToken {
  challengeConfirmationToken: VerifiedChallengeConfirmationToken;
  challengeSessionToken: JwtVerifyData;
  rdcSessionToken: JwtVerifyData<Record<string, any>, Record<string, any>>;
  enrolmentSessionToken: JwtVerifyData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
}

export type ServerKoaContext<Data = any> = LindormNodeServerKoaContext<Context, Data>;

export type ServerKoaController<Data = any> = Controller<ServerKoaContext<Data>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
