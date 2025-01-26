import { IRedisEntity } from "../interfaces";

export class RedisEntityBase implements IRedisEntity {
  public readonly id!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public expiresAt!: Date | null;
}
