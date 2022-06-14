import { Account, AuthenticationSession, BrowserLink, StrategySession } from "../entity";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  StrategySessionCache,
} from "../infrastructure";

export const accountEntityMiddleware = repositoryEntityMiddleware(Account, AccountRepository);

export const authenticationSessionEntityMiddleware = cacheEntityMiddleware(
  AuthenticationSession,
  AuthenticationSessionCache,
);

export const browserLinkEntityMiddleware = repositoryEntityMiddleware(
  BrowserLink,
  BrowserLinkRepository,
);

export const strategySessionEntityMiddleware = cacheEntityMiddleware(
  StrategySession,
  StrategySessionCache,
);
