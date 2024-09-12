import { MongoFileBase } from "../../classes";
import { ValidateFileFn } from "../../types";

export type TestFileOneOptions = {
  name: string;
};

export class TestFileOne extends MongoFileBase {
  public readonly name: string;

  public constructor(options: TestFileOneOptions) {
    super();

    this.name = options.name;
  }
}

export const validate: ValidateFileFn<TestFileOne> = (metadata) => {
  if (!metadata.mimeType) {
    throw new Error("Missing mimeType");
  }

  if (!metadata.originalName) {
    throw new Error("Missing originalName");
  }
};
