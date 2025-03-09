import "reflect-metadata";
import {
  VersionColumn,
  VersionEndDateColumn,
  VersionKeyColumn,
  VersionStartDateColumn,
} from "../decorators";
import { IVersionedEntityBase } from "../interfaces";
import { EntityBase } from "./EntityBase";

export abstract class VersionedEntityBase
  extends EntityBase
  implements IVersionedEntityBase
{
  @VersionColumn()
  public readonly version!: number;

  @VersionKeyColumn()
  public readonly versionId!: string;

  @VersionStartDateColumn()
  public readonly versionStartAt!: Date;

  @VersionEndDateColumn()
  public versionEndAt!: Date | null;
}
