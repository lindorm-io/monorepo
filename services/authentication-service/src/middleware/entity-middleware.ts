import { LoginSession, FlowSession, Account } from "../entity";
import { LoginSessionCache, FlowSessionCache, AccountRepository } from "../infrastructure";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";

export const accountEntityMiddleware = repositoryEntityMiddleware(Account, AccountRepository);

export const loginSessionEntityMiddleware = cacheEntityMiddleware(LoginSession, LoginSessionCache);

export const flowSessionEntityMiddleware = cacheEntityMiddleware(FlowSession, FlowSessionCache);
