import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { MnemosConstraint } from "./mnemos-collection";
import { CreateMnemosEntityFn, ValidateMnemosEntityFn } from "./mnemos-repository";

export type MnemosSourceEntity<E extends IEntity = IEntity> = {
  Entity: Constructor<E>;
  constraints?: Array<MnemosConstraint<E>>;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};

export type MnemosSourceEntities = Array<
  Constructor<IEntity> | MnemosSourceEntity | string
>;

export type CloneMnemosSourceOptions = {
  logger?: ILogger;
};

export type MnemosSourceOptions = {
  entities?: MnemosSourceEntities;
  logger: ILogger;
};
