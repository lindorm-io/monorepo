import { IEntityBase } from "@lindorm/entity";

export interface IElasticEntity extends IEntityBase {
  primaryTerm: number;
  rev: number;
  seq: number;
  deletedAt: Date | null;
  expiresAt: Date | null;
}
