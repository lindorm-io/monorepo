import { IRedisEntity } from "../../interfaces";

export class TestEntityOne implements IRedisEntity {
  public readonly id!: string;
  public readonly createdAt!: Date;

  public email!: string;
  public expiresAt!: Date | undefined;
  public name!: string;
  public updatedAt!: Date;

  public validate(): void {
    if (!this.email) {
      throw new Error("Missing email");
    }

    if (!this.name) {
      throw new Error("Missing name");
    }
  }
}