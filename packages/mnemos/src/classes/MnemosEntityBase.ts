import { IMnemosEntity } from "../interfaces";

export class MnemosEntityBase implements IMnemosEntity {
  public readonly id!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public expiresAt!: Date | null;
}
