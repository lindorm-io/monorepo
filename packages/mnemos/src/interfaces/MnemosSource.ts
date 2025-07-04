import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { CloneMnemosSourceOptions, MnemosSourceRepositoryOptions } from "../types";
import { IMnemosCache } from "./MnemosCache";
import { IMnemosRepository } from "./MnemosRepository";

export interface IMnemosSource {
  name: "MnemosSource";

  client: IMnemosCache;

  clone(options?: CloneMnemosSourceOptions): IMnemosSource;

  addEntities(entities: EntityScannerInput): void;
  repository<E extends IEntity>(
    Entity: Constructor<E>,
    options?: MnemosSourceRepositoryOptions,
  ): IMnemosRepository<E>;
}
