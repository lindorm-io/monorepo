import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import MockDate from "mockdate";
import { MongoClient } from "mongodb";
import { join } from "path";
import { Readable } from "stream";
import { TestBucket } from "../__fixtures__/test-bucket";
import { TestFile } from "../__fixtures__/test-file";
import { getReadStreamContent } from "../__fixtures__/utils";
import { MongoBucketError } from "../errors";
import { FileUpload } from "../types";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("MongoBucket", () => {
  let client: MongoClient;
  let bucket: TestBucket;
  let stream: () => Readable;
  let metadata: FileUpload<TestFile>;

  beforeAll(async () => {
    client = new MongoClient("mongodb://root:example@localhost/admin?authSource=admin");
    await client.connect();
    bucket = new TestBucket(client, createMockLogger());
  });

  beforeEach(async () => {
    stream = () =>
      createReadStream(join(__dirname, "..", "__fixtures__", "test-file-upload.txt"));

    metadata = {
      encoding: "7bit",
      extraOne: 1,
      extraTwo: 2,
      hash: "hash",
      hashAlgorithm: "sha256",
      mimeType: "text/plain",
      name: randomUUID(),
      originalName: "test-file-upload.txt",
      size: 18,
      strategy: "local",
    };
  });

  afterAll(async () => {
    await client.close();
  });

  test("should setup", async () => {
    await expect(bucket.setup()).resolves.not.toThrow();
  }, 30000);

  test("should delete many files", async () => {
    const f1 = await bucket.upload(stream(), metadata);
    const f2 = await bucket.upload(stream(), metadata);

    await expect(bucket.delete({ name: f1.name })).resolves.not.toThrow();

    await expect(bucket.findOne({ filename: f1.filename })).resolves.toBeNull();
    await expect(bucket.download(f1.filename)).rejects.toThrow();

    await expect(bucket.findOne({ filename: f2.filename })).resolves.toBeNull();
    await expect(bucket.download(f2.filename)).rejects.toThrow();
  });

  test("should download file by name", async () => {
    const result = await bucket.upload(stream(), metadata);
    const download = await bucket.download(result.filename);

    expect(download.chunkSize).toEqual(261120);
    expect(download.filename).toEqual(result.filename);
    expect(download.length).toEqual(18);
    expect(download.mimeType).toEqual("text/plain");
    expect(download.originalName).toEqual("test-file-upload.txt");
    expect(download.uploadDate).toEqual(MockedDate);

    await expect(getReadStreamContent(download.stream)).resolves.toEqual(
      "test file content\n",
    );
  });

  test("should find many files", async () => {
    const f1 = await bucket.upload(stream(), metadata);
    const f2 = await bucket.upload(stream(), metadata);

    await expect(bucket.find({ name: f1.name })).resolves.toEqual([f1, f2]);
    await expect(bucket.find({ name: randomUUID() })).resolves.toEqual([]);
  });

  test("should find one file", async () => {
    const file = await bucket.upload(stream(), metadata);

    await expect(bucket.findOne({ name: file.name })).resolves.toEqual(file);
    await expect(bucket.findOne({ name: randomUUID() })).resolves.toBeNull();
  });

  test("should find one or fail", async () => {
    const file = await bucket.upload(stream(), metadata);

    await expect(bucket.findOneOrFail({ name: file.name })).resolves.toEqual(file);
    await expect(bucket.findOneOrFail({ name: randomUUID() })).rejects.toThrow(
      MongoBucketError,
    );
  });

  test("should find one file by filename", async () => {
    const file = await bucket.upload(stream(), metadata);

    await expect(bucket.findOne({ filename: file.filename })).resolves.toEqual(file);
    await expect(bucket.findOne({ filename: randomUUID() })).resolves.toBeNull();
  });

  test("should find one file by filename or fail", async () => {
    const file = await bucket.upload(stream(), metadata);

    await expect(bucket.findOneOrFail({ filename: file.filename })).resolves.toEqual(
      file,
    );
    await expect(bucket.findOneOrFail({ filename: randomUUID() })).rejects.toThrow(
      MongoBucketError,
    );
  });

  test("should upload file", async () => {
    await expect(bucket.upload(stream(), metadata)).resolves.toEqual({
      chunkSize: 261120,
      encoding: "7bit",
      extraOne: 1,
      extraTwo: 2,
      filename: expect.any(String),
      hash: "hash",
      hashAlgorithm: "sha256",
      length: 18,
      mimeType: "text/plain",
      name: metadata.name,
      originalName: "test-file-upload.txt",
      size: 18,
      strategy: "local",
      uploadDate: MockedDate,
    });
  });
});
