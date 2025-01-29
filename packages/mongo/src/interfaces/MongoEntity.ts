import { IEntityBase } from "@lindorm/entity";

export interface IMongoEntity extends IEntityBase {
  rev: number;
  seq: number;
  deletedAt: Date | null;
  expiresAt: Date | null;
}
