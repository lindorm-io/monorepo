import { RedisEntityBase } from "../classes";

export type TestEntityOptions = {
  email?: string;
  name: string;
};

export class TestEntity extends RedisEntityBase {
  public email!: string | null;
  public name!: string;
}
