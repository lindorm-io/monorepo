import { MongoFileBase } from "../classes";

export type TestFileOptions = {
  name: string;
};

export class TestFile extends MongoFileBase {
  public readonly name: string;

  public constructor(options: TestFileOptions) {
    super();

    this.name = options.name;
  }
}
