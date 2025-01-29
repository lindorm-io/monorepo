import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IMnemosCache } from "../interfaces";
import { MnemosConstraint } from "./mnemos-collection";
import {
  CreateMnemosEntityFn,
  MnemosEntityConfig,
  ValidateMnemosEntityFn,
} from "./mnemos-entity";

export type MnemosRepositoryOptions<E extends IEntityBase> = {
  Entity: Constructor<E>;
  cache: IMnemosCache;
  config?: MnemosEntityConfig<E>;
  constraints?: Array<MnemosConstraint<E>>;
  logger: ILogger;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};
