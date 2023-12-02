import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
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

export const challengeSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  ChallengeSession,
  ChallengeSessionCache,
);

export const clientEntityMiddleware = mongoRepositoryEntityMiddleware(Client, ClientRepository);

export const deviceLinkEntityMiddleware = mongoRepositoryEntityMiddleware(
  DeviceLink,
  DeviceLinkRepository,
);

export const enrolmentSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  EnrolmentSession,
  EnrolmentSessionCache,
);

export const publicKeyEntityMiddleware = mongoRepositoryEntityMiddleware(
  PublicKey,
  PublicKeyRepository,
);

export const rdcSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  RdcSession,
  RdcSessionCache,
);
