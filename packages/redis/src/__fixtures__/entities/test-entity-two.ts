import { IRedisEntity } from "../../interfaces";

export class TestEntityTwo implements IRedisEntity {
  public readonly id!: string;
  public readonly createdAt!: Date;

  public email!: string;
  public expiresAt!: Date | undefined;
  public name!: string;
  public updatedAt!: Date;
}
