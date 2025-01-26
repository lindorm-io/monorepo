import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IMnemosCache, IMnemosEntity } from "../interfaces";
import { MnemosConstraint } from "./mnemos-collection";

export type CreateMnemosEntityFn<E extends IMnemosEntity = IMnemosEntity> = (
  options: DeepPartial<E>,
) => E;

export type ValidateMnemosEntityFn<E extends IMnemosEntity = IMnemosEntity> = (
  entity: Omit<E, "id" | "createdAt" | "updatedAt" | "expiresAt">,
) => void;

export type MnemosRepositoryOptions<E extends IMnemosEntity> = {
  Entity: Constructor<E>;
  cache: IMnemosCache;
  constraints?: Array<MnemosConstraint<E>>;
  logger: ILogger;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};
