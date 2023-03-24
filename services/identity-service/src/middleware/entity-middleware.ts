import { Address, Identifier, Identity } from "../entity";
import { AddressRepository, IdentifierRepository, IdentityRepository } from "../infrastructure";
import { mongoRepositoryEntityMiddleware } from "@lindorm-io/koa-mongo";

export const addressEntityMiddleware = mongoRepositoryEntityMiddleware(Address, AddressRepository);

export const identifierEntityMiddleware = mongoRepositoryEntityMiddleware(
  Identifier,
  IdentifierRepository,
);

export const identityEntityMiddleware = mongoRepositoryEntityMiddleware(
  Identity,
  IdentityRepository,
);
