import { randomUUID } from "crypto";
import { IMongoEntity } from "../interfaces";

export class MongoEntityBase implements IMongoEntity {
  public readonly id: string;
  public readonly rev: number;
  public readonly seq: number;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly deletedAt: Date | null;

  public expiresAt: Date | null;

  public constructor(options: Partial<IMongoEntity> = {}) {
    this.id = options.id ?? randomUUID();
    this.rev = options.rev ?? 0;
    this.seq = options.seq ?? 0;
    this.createdAt = options.createdAt ?? new Date();
    this.updatedAt = options.updatedAt ?? new Date();
    this.deletedAt = options.deletedAt ?? null;
    this.expiresAt = options.expiresAt ?? null;
  }
}
