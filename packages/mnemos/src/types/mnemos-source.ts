import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IMnemosEntity } from "../interfaces";
import { MnemosConstraint } from "./mnemos-collection";
import { CreateMnemosEntityFn, ValidateMnemosEntityFn } from "./mnemos-repository";

export type MnemosSourceEntity<E extends IMnemosEntity = IMnemosEntity> = {
  Entity: Constructor<E>;
  constraints?: Array<MnemosConstraint<E>>;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};

export type MnemosSourceEntities = Array<
  Constructor<IMnemosEntity> | MnemosSourceEntity | string
>;

export type CloneMnemosSourceOptions = {
  logger?: ILogger;
};

export type MnemosSourceOptions = {
  entities?: MnemosSourceEntities;
  logger: ILogger;
};
