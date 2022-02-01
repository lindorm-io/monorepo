import { LoginSession, FlowSession } from "../entity";
import { LoginSessionCache, FlowSessionCache } from "../infrastructure";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";

export const loginSessionEntityMiddleware = cacheEntityMiddleware(LoginSession, LoginSessionCache);

export const flowSessionEntityMiddleware = cacheEntityMiddleware(FlowSession, FlowSessionCache);
