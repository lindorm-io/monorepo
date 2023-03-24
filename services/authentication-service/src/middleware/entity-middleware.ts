import { Account, AuthenticationSession, BrowserLink, StrategySession } from "../entity";
import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import { redisRepositoryEntityMiddleware } from "@lindorm-io/koa-redis";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  StrategySessionCache,
} from "../infrastructure";

export const accountEntityMiddleware = mongoRepositoryEntityMiddleware(Account, AccountRepository);

export const authenticationSessionEntityMiddleware = redisRepositoryEntityMiddleware(
  AuthenticationSession,
  AuthenticationSessionCache,
);

export const browserLinkEntityMiddleware = mongoRepositoryEntityMiddleware(
  BrowserLink,
  BrowserLinkRepository,
);

export const strategySessionEntityMiddleware = redisRepositoryEntityMiddleware(
  StrategySession,
  StrategySessionCache,
);
