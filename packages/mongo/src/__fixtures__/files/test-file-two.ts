import { MongoFileBase } from "../../classes";
import { MongoIndexOptions } from "../../types";

export type TestFileTwoOptions = {
  name: string;
};

export class TestFileTwo extends MongoFileBase {
  public readonly name: string;

  public constructor(options: TestFileTwoOptions) {
    super();

    this.name = options.name;
  }
}

export const indexes: Array<MongoIndexOptions<TestFileTwo>> = [
  {
    index: { name: 1 },
  },
];
