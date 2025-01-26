import { IMongoEntity } from "../interfaces";

export class MongoEntityBase implements IMongoEntity {
  public readonly id!: string;
  public readonly rev!: number;
  public readonly seq!: number;
  public readonly createdAt!: Date;
  public readonly deletedAt!: Date | null;
  public readonly updatedAt!: Date;

  public expiresAt!: Date | null;
}
