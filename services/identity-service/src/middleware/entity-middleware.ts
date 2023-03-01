import { Address, Identifier, Identity } from "../entity";
import { AddressRepository, IdentifierRepository, IdentityRepository } from "../infrastructure";
import { repositoryEntityMiddleware } from "@lindorm-io/koa-mongo";

export const addressEntityMiddleware = repositoryEntityMiddleware(Address, AddressRepository);

export const identifierEntityMiddleware = repositoryEntityMiddleware(
  Identifier,
  IdentifierRepository,
);

export const identityEntityMiddleware = repositoryEntityMiddleware(Identity, IdentityRepository);
