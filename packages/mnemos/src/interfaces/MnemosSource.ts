import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import {
  CloneMnemosSourceOptions,
  CreateMnemosEntityFn,
  MnemosSourceEntities,
  ValidateMnemosEntityFn,
} from "../types";
import { IMnemosCache } from "./MnemosCache";
import { IMnemosEntity } from "./MnemosEntity";
import { IMnemosRepository } from "./MnemosRepository";

export type MnemosSourceRepositoryOptions<E extends IMnemosEntity> = {
  logger?: ILogger;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};

export interface IMnemosSource {
  client: IMnemosCache;

  addEntities(entities: MnemosSourceEntities): void;
  clone(options?: CloneMnemosSourceOptions): IMnemosSource;
  repository<E extends IMnemosEntity>(
    Entity: Constructor<E>,
    options?: MnemosSourceRepositoryOptions<E>,
  ): IMnemosRepository<E>;
}
