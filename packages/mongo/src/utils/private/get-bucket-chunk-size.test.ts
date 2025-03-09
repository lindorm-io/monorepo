import { globalEntityMetadata } from "@lindorm/entity";
import { MongoFileBase } from "../../classes";
import { File, FileExtra } from "../../decorators";
import { getBucketChunkSize } from "./get-bucket-chunk-size";

describe("getBucketChunkSize", () => {
  test("should return bytes from entity decorator", () => {
    @File({ chunkSizeBytes: 1024 })
    class TestMongoFileBaseOne extends MongoFileBase {}

    const metadata = globalEntityMetadata.get<FileExtra>(TestMongoFileBaseOne);
    const options = {
      File: TestMongoFileBaseOne,
      client: {} as any,
      logger: {} as any,
      chunkSizeBytes: 2048,
    };

    expect(getBucketChunkSize(options, metadata)).toEqual(1024);
  });

  test("should return bytes from options", () => {
    @File()
    class TestMongoFileBaseOne extends MongoFileBase {}

    const metadata = globalEntityMetadata.get<FileExtra>(TestMongoFileBaseOne);
    const options = {
      File: TestMongoFileBaseOne,
      client: {} as any,
      logger: {} as any,
      chunkSizeBytes: 2048,
    };

    expect(getBucketChunkSize(options, metadata)).toEqual(2048);
  });

  test("should return null", () => {
    @File()
    class TestMongoFileBaseOne extends MongoFileBase {}

    const metadata = globalEntityMetadata.get<FileExtra>(TestMongoFileBaseOne);
    const options = {
      File: TestMongoFileBaseOne,
      client: {} as any,
      logger: {} as any,
    };

    expect(getBucketChunkSize(options, metadata)).toEqual(null);
  });
});
