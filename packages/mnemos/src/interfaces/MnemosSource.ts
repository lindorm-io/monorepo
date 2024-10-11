import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import {
  CloneMnemosSourceOptions,
  CreateMnemosEntityFn,
  MnemosSourceEntities,
  ValidateMnemosEntityFn,
} from "../types";
import { IMnemosCache } from "./MnemosCache";
import { IMnemosRepository } from "./MnemosRepository";

export type MnemosSourceRepositoryOptions<E extends IEntity> = {
  logger?: ILogger;
  create?: CreateMnemosEntityFn<E>;
  validate?: ValidateMnemosEntityFn<E>;
};

export interface IMnemosSource {
  client: IMnemosCache;

  addEntities(entities: MnemosSourceEntities): void;
  clone(options?: CloneMnemosSourceOptions): IMnemosSource;
  repository<E extends IEntity>(
    Entity: Constructor<E>,
    options?: MnemosSourceRepositoryOptions<E>,
  ): IMnemosRepository<E>;
}
