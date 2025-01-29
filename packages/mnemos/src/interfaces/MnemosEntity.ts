import { IEntityBase } from "@lindorm/entity";

export interface IMnemosEntity extends IEntityBase {
  expiresAt: Date | null;
}
