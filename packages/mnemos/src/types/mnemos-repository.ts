import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IMnemosCache } from "../interfaces";
import { MnemosConstraint } from "./mnemos-collection";

export type CreateMnemosEntityFn<E extends IEntity = IEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateMnemosEntityFn<E extends IEntity = IEntity> = (
  entity: Omit<
    E,
    "id" | "rev" | "seq" | "createdAt" | "updatedAt" | "deletedAt" | "expiresAt"
  >,
) => void;

export type MnemosRepositoryOptions<E extends IEntity> = {
  Entity: Constructor<E>;
  cache: IMnemosCache;
  constraints?: Array<MnemosConstraint<E>>;
  logger: ILogger;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};
