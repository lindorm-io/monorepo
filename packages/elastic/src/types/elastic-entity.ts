import { IEntityBase } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";

export type CreateElasticEntityFn<E extends IEntityBase = IEntityBase> = (
  options: DeepPartial<E>,
) => E;

export type ValidateElasticEntityFn<E extends IEntityBase = IEntityBase> = (
  entity: Omit<E, "id" | "createdAt" | "updatedAt">,
) => void;

export type ElasticEntityConfig<E extends IEntityBase = IEntityBase> = {
  deleteAttribute?: keyof E; // Date | null
  primaryTermAttribute?: keyof E; // number
  revisionAttribute?: keyof E; // number
  sequenceAttribute?: keyof E; // number
  ttlAttribute?: keyof E; // Date | null
};
