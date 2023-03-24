import { ChallengeSession, DeviceLink, EnrolmentSession, RdcSession } from "../entity";
import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../infrastructure";

export const challengeSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  ChallengeSession,
  ChallengeSessionCache,
);

export const deviceLinkEntityMiddleware = mongoRepositoryEntityMiddleware(
  DeviceLink,
  DeviceLinkRepository,
);

export const enrolmentSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  EnrolmentSession,
  EnrolmentSessionCache,
);

export const rdcSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  RdcSession,
  RdcSessionCache,
);
