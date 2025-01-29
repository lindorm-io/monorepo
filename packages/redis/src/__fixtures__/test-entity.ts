import { RedisEntity } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends RedisEntity {
  public email!: string | null;
  public name!: string;
}
