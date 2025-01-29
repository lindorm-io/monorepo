import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MnemosConstraint } from "./mnemos-collection";
import {
  CreateMnemosEntityFn,
  MnemosEntityConfig,
  ValidateMnemosEntityFn,
} from "./mnemos-entity";

export type MnemosSourceEntity<E extends IEntityBase = IEntityBase> = {
  Entity: Constructor<E>;
  config?: MnemosEntityConfig<E>;
  constraints?: Array<MnemosConstraint<E>>;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};

export type MnemosSourceEntities = Array<
  Constructor<IEntityBase> | MnemosSourceEntity | string
>;

export type CloneMnemosSourceOptions = {
  logger?: ILogger;
};

export type MnemosSourceOptions = {
  entities?: MnemosSourceEntities;
  logger: ILogger;
};
