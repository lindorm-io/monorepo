import { MongoFile } from "../../classes";
import { MongoIndexOptions } from "../../types";

export type TestFileTwoOptions = {
  name: string;
};

export class TestFileTwo extends MongoFile {
  public readonly name!: string;
}

export const indexes: Array<MongoIndexOptions<TestFileTwo>> = [
  {
    index: { name: 1 },
  },
];
