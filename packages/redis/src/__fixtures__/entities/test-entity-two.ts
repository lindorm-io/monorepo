import { IRedisEntity } from "../../interfaces";

export class TestEntityTwo implements IRedisEntity {
  public readonly id!: string;
  public readonly createdAt!: Date;

  public _test!: string;
  public email!: string;
  public expiresAt!: Date | undefined;
  public name!: string;
  public updatedAt!: Date;

  public toJSON(): Partial<TestEntityTwo> {
    return {
      createdAt: this.createdAt,
      email: this.email,
      expiresAt: this.expiresAt,
      id: this.id,
      name: this.name,
      updatedAt: this.updatedAt,
    };
  }
}
