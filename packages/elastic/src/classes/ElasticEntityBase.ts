import { IElasticEntity } from "../interfaces";

export class ElasticEntityBase implements IElasticEntity {
  public readonly id!: string;
  public readonly primaryTerm!: number;
  public readonly rev!: number;
  public readonly seq!: number;
  public readonly createdAt!: Date;
  public readonly deletedAt!: Date | null;
  public readonly updatedAt!: Date;

  public expiresAt!: Date | null;
}
