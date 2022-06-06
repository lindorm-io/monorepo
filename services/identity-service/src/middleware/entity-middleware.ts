import { Address, ConnectSession, Identifier, Identity } from "../entity";
import { cacheEntityMiddleware } from "@lindorm-io/koa-redis";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";
import {
  AddressRepository,
  ConnectSessionCache,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";

export const addressEntityMiddleware = repositoryEntityMiddleware(Address, AddressRepository);

export const connectSessionEntityMiddleware = cacheEntityMiddleware(
  ConnectSession,
  ConnectSessionCache,
);

export const identifierEntityMiddleware = repositoryEntityMiddleware(
  Identifier,
  IdentifierRepository,
);

export const identityEntityMiddleware = repositoryEntityMiddleware(Identity, IdentityRepository);
