import { Axios } from "@lindorm-io/axios";
import { ChallengeSession, DeviceLink, EnrolmentSession, RdcSession } from "../entity";
import { Controller } from "@lindorm-io/koa";
import { Dict } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";
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

type ServerAxios = LindormNodeServerAxios & {
  communicationClient: Axios;
  oauthClient: Axios;
  vaultClient: Axios;
};

type ServerCache = LindormNodeServerCache & {
  challengeSessionCache: ChallengeSessionCache;
  rdcSessionCache: RdcSessionCache;
  enrolmentSessionCache: EnrolmentSessionCache;
};

type ServerEntity = {
  challengeSession: ChallengeSession;
  deviceLink: DeviceLink;
  rdcSession: RdcSession;
  enrolmentSession: EnrolmentSession;
};

type ServerRepository = LindormNodeServerRepository & {
  deviceLinkRepository: DeviceLinkRepository;
};

type ServerToken = LindormNodeServerToken & {
  challengeConfirmationToken: VerifiedChallengeConfirmationToken;
  challengeSessionToken: JwtDecodeData;
  rdcSessionToken: JwtDecodeData<Record<string, any>, Record<string, any>>;
  enrolmentSessionToken: JwtDecodeData;
};

type Context = LindormNodeServerContext & {
  axios: ServerAxios;
  cache: ServerCache;
  entity: ServerEntity;
  repository: ServerRepository;
  token: ServerToken;
};

export type ServerKoaContext<D extends Dict = Dict> = LindormNodeServerKoaContext<Context, D>;

export type ServerKoaController<D extends Dict = Dict> = Controller<ServerKoaContext<D>>;

export type ServerKoaMiddleware = LindormNodeServerKoaMiddleware<ServerKoaContext>;
