import { IEntityBase } from "./EntityBase";

export interface IVersionedEntityBase extends IEntityBase {
  version: number;
  versionId: string;
  versionStartAt: Date;
  versionEndAt: Date | null;
}
