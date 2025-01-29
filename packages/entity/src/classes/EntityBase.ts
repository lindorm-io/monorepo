import { IEntityBase } from "../interfaces";

export class EntityBase implements IEntityBase {
  public readonly id!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}
