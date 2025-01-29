import { RedisEntity } from "../../classes";

export class TestEntityTwo extends RedisEntity {
  public readonly email!: string;
  public readonly name!: string;
  public readonly _test!: string;
}
