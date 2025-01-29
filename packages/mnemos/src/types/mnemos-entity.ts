import { IEntityBase } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";

export type CreateMnemosEntityFn<E extends IEntityBase = IEntityBase> = (
  options: DeepPartial<E>,
) => E;

export type ValidateMnemosEntityFn<E extends IEntityBase = IEntityBase> = (
  entity: Omit<E, "id" | "createdAt" | "updatedAt">,
) => void;

export type MnemosEntityConfig<E extends IEntityBase = IEntityBase> = {
  ttlAttribute?: keyof E;
};
