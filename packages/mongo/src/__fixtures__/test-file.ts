import { MongoFile } from "../classes";

export type TestFileOptions = {
  name: string;
};

export class TestFile extends MongoFile {
  public readonly name!: string;
}
