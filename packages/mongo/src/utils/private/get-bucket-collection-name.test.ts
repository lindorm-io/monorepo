import { MongoFileBase } from "../../classes";
import { File } from "../../decorators";
import { getBucketCollectionName } from "./get-bucket-collection-name";

describe("getBucketCollectionName", () => {
  test("should return bucket name", () => {
    @File()
    class TestMongoFileBaseOne extends MongoFileBase {}

    expect(getBucketCollectionName(TestMongoFileBaseOne, {})).toEqual(
      "file.test_mongo_file_base_one.files",
    );
  });
});
