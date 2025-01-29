import { IEntityBase } from "@lindorm/entity";

export interface IRedisEntity extends IEntityBase {
  expiresAt: Date | null;
}
