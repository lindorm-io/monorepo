import { globalEntityMetadata } from "@lindorm/entity";
import { MongoFileBase } from "../../classes";
import { File } from "../../decorators";
import { getBucketMetadataIndexes } from "./get-bucket-metadata-indexes";

describe("getBucketMetadataIndexes", () => {
  test("should return array for MongoFileBase", () => {
    @File()
    class TestMongoFileBase extends MongoFileBase {}

    const metadata = globalEntityMetadata.get(TestMongoFileBase);

    expect(getBucketMetadataIndexes(metadata)).toMatchSnapshot();
  });
});
