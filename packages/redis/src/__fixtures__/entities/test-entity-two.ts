import { RedisEntityBase } from "../../classes";

export class TestEntityTwo extends RedisEntityBase {
  public readonly email: string;
  public readonly name: string;
  public readonly _test: string;

  public constructor(data: Pick<TestEntityTwo, "email" | "name">) {
    super();

    this.email = data.email ?? "";
    this.name = data.name ?? "";
    this._test = "test";
  }
}
