import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { ChallengeSession, DeviceLink, EnrolmentSession, RdcSession } from "../entity";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../infrastructure";

export const challengeSessionEntityMiddleware = cacheEntityMiddleware(
  ChallengeSession,
  ChallengeSessionCache,
);

export const deviceLinkEntityMiddleware = repositoryEntityMiddleware(
  DeviceLink,
  DeviceLinkRepository,
);

export const enrolmentSessionEntityMiddleware = cacheEntityMiddleware(
  EnrolmentSession,
  EnrolmentSessionCache,
);

export const rdcSessionEntityMiddleware = cacheEntityMiddleware(RdcSession, RdcSessionCache);
