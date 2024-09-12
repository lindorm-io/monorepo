import { MongoEntityBase } from "../../classes";
import { MongoIndexOptions } from "../../types";

export class TestEntityTwo extends MongoEntityBase {
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

export const indexes: Array<MongoIndexOptions<TestEntityTwo>> = [
  {
    index: { name: 1 },
  },
];
