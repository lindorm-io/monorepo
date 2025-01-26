import { MongoFileBase } from "../../classes";
import { ValidateMongoFileFn } from "../../types";

export type TestFileOneOptions = {
  name: string;
};

export class TestFileOne extends MongoFileBase {
  public readonly name!: string;
}

export const validate: ValidateMongoFileFn<TestFileOne> = (metadata) => {
  if (!metadata.mimeType) {
    throw new Error("Missing mimeType");
  }

  if (!metadata.originalName) {
    throw new Error("Missing originalName");
  }
};
