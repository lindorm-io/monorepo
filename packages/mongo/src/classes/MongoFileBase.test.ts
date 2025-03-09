import { globalEntityMetadata } from "@lindorm/entity";
import { File } from "../decorators";
import { MongoFileBase } from "./MongoFileBase";

describe("File", () => {
  test("should have expected properties", () => {
    @File()
    class TestFile extends MongoFileBase {}

    expect(new TestFile()).toMatchSnapshot();
    expect(globalEntityMetadata.get(TestFile)).toMatchSnapshot();
  });
});
