import { RedisEntityBase } from "../../classes";

export class TestEntityTwo extends RedisEntityBase {
  public readonly email!: string;
  public readonly name!: string;
  public readonly _test!: string;
}
