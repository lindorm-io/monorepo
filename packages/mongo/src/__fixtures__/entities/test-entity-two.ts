import { MongoEntity } from "../../classes";
import { MongoIndexOptions } from "../../types";

export class TestEntityTwo extends MongoEntity {
  public readonly email!: undefined;
  public readonly name!: string;
  public readonly _test!: string;
}

export const indexes: Array<MongoIndexOptions<TestEntityTwo>> = [
  {
    index: { name: 1 },
  },
];
