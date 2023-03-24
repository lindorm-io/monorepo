import { Axios } from "@lindorm-io/axios";
import { ChallengeSession, DeviceLink, EnrolmentSession, RdcSession } from "../entity";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
import { VerifiedChallengeConfirmationToken } from "../common";
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

interface ServerEntity {
  challengeSession: ChallengeSession;
  deviceLink: DeviceLink;
  rdcSession: RdcSession;
  enrolmentSession: EnrolmentSession;
}

interface ServerMongo extends LindormNodeServerMongo {
  deviceLinkRepository: DeviceLinkRepository;
}

interface ServerRedis extends LindormNodeServerRedis {
  challengeSessionCache: ChallengeSessionCache;
  rdcSessionCache: RdcSessionCache;
  enrolmentSessionCache: EnrolmentSessionCache;
}

interface ServerToken extends LindormNodeServerToken {
  challengeConfirmationToken: VerifiedChallengeConfirmationToken;
  challengeSessionToken: JwtDecodeData;
  rdcSessionToken: JwtDecodeData<Record<string, any>>;
  enrolmentSessionToken: JwtDecodeData;
}

interface Context extends LindormNodeServerContext {
  axios: ServerAxios;
  entity: ServerEntity;
  memory: LindormNodeServerMemory;
  mongo: ServerMongo;
  redis: ServerRedis;
  token: ServerToken;
}

export interface ServerKoaContext<D extends Dict = Dict>
  extends LindormNodeServerKoaContext<Context, D> {}

export interface ServerKoaController<D extends Dict = Dict>
  extends Controller<ServerKoaContext<D>> {}

export interface ServerKoaMiddleware extends LindormNodeServerKoaMiddleware<ServerKoaContext> {}
