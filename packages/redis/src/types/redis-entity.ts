import { IEntityBase } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";

export type CreateRedisEntityFn<E extends IEntityBase = IEntityBase> = (
  options: DeepPartial<E>,
) => E;

export type ValidateRedisEntityFn<E extends IEntityBase = IEntityBase> = (
  entity: Omit<E, "id" | "createdAt" | "updatedAt">,
) => void;

export type RedisEntityConfig<E extends IEntityBase = IEntityBase> = {
  ttlAttribute?: keyof E; // Date | null
};
