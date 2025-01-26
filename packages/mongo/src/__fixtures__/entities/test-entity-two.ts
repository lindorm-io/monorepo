import { EntityBase } from "@lindorm/entity";
import { MongoIndexOptions } from "../../types";

export class TestEntityTwo extends EntityBase {
  public readonly email!: undefined;
  public readonly name!: string;
  public readonly _test!: string;
}

export const indexes: Array<MongoIndexOptions<TestEntityTwo>> = [
  {
    index: { name: 1 },
  },
];
