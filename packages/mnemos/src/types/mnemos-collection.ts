import { EntityMetadata, IEntity } from "@lindorm/entity";

export type MnemosConstraint<T extends IEntity = IEntity> = {
  unique: Array<keyof T>;
  nullable?: Array<keyof T>;
};

export type MnemosCollectionOptions = {
  metadata?: EntityMetadata;
};
