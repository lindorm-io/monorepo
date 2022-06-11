import { LoginSession, FlowSession, Account, BrowserLink } from "../entity";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import {
  LoginSessionCache,
  FlowSessionCache,
  AccountRepository,
  BrowserLinkRepository,
} from "../infrastructure";

export const accountEntityMiddleware = repositoryEntityMiddleware(Account, AccountRepository);

export const browserLinkEntityMiddleware = repositoryEntityMiddleware(
  BrowserLink,
  BrowserLinkRepository,
);

export const loginSessionEntityMiddleware = cacheEntityMiddleware(LoginSession, LoginSessionCache);

export const flowSessionEntityMiddleware = cacheEntityMiddleware(FlowSession, FlowSessionCache);
