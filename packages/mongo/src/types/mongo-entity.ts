import { IEntityBase } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";

export type CreateMongoEntityFn<E extends IEntityBase = IEntityBase> = (
  options: DeepPartial<E>,
) => E;

export type ValidateMongoEntityFn<E extends IEntityBase = IEntityBase> = (
  entity: Omit<E, "id" | "createdAt" | "updatedAt">,
) => void;

export type MongoEntityConfig<E extends IEntityBase = IEntityBase> = {
  deleteAttribute?: keyof E; // Date | null
  revisionAttribute?: keyof E; // number
  sequenceAttribute?: keyof E; // number
  ttlAttribute?: keyof E; // Date | null
};
