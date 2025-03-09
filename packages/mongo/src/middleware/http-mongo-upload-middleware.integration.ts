import { createMockAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger";
import { Pylon, PylonOptions, PylonRouter } from "@lindorm/pylon";
import MockDate from "mockdate";
import { join } from "path";
import request from "supertest";
import { TestFile } from "../__fixtures__/test-file";
import { MongoSource } from "../classes";
import { IMongoSource } from "../interfaces";
import { MongoPylonHttpContext } from "../types";
import { createHttpMongoSourceMiddleware } from "./http-mongo-source-middleware";
import { createHttpMongoUploadMiddleware } from "./http-mongo-upload-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpMongoUploadMiddleware", () => {
  let source: IMongoSource;
  let options: PylonOptions<MongoPylonHttpContext>;
  let router: PylonRouter<MongoPylonHttpContext>;

  beforeAll(async () => {
    const amphora = createMockAmphora();
    const logger = createMockLogger();

    source = new MongoSource({
      files: [TestFile],
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
      database: "test_database",
    });

    await source.setup();

    router = new PylonRouter<MongoPylonHttpContext>();

    router.post(
      "/upload",
      createHttpMongoSourceMiddleware(source),
      createHttpMongoUploadMiddleware(TestFile),
      async (ctx) => {
        ctx.body = ctx.files;
        ctx.status = 200;
      },
    );

    options = {
      amphora,
      logger,
      parseBody: {
        multipart: true,
      },
      httpRouters: [{ path: "/test", router }],
    };
  }, 10000);

  afterAll(async () => {
    await source.disconnect();
  });

  test("should upload a file using busboy", async () => {
    const pylon = new Pylon(options);

    const response = await request(pylon.callback)
      .post("/test/upload")
      .set("x-file-meta-extra-one", "1")
      .set("x-file-meta-extra-two", "2")
      .attach("upload.txt", join(__dirname, "..", "__fixtures__", "test-file-upload.txt"))
      .expect(200);

    expect(response.body).toEqual([
      {
        chunkSize: 261120,
        encoding: "7bit",
        extraOne: 1,
        extraTwo: 2,
        filename: expect.any(String),
        hash: null,
        hashAlgorithm: null,
        length: 18,
        mimeType: "text/plain",
        name: null,
        originalName: "upload.txt",
        size: null,
        strategy: "busboy",
        uploadDate: MockedDate.toISOString(),
      },
    ]);

    const bucket = source.bucket(TestFile);

    await expect(
      bucket.findOne({ filename: response.body[0].filename }),
    ).resolves.toEqual({
      chunkSize: 261120,
      encoding: "7bit",
      extraOne: 1,
      extraTwo: 2,
      filename: response.body[0].filename,
      hash: null,
      hashAlgorithm: null,
      length: 18,
      mimeType: "text/plain",
      name: null,
      originalName: "upload.txt",
      size: null,
      strategy: "busboy",
      uploadDate: MockedDate,
    });
  });

  test("should upload a file using formidable", async () => {
    options.parseBody!.formidable = true;

    const pylon = new Pylon(options);

    const response = await request(pylon.callback)
      .post("/test/upload")
      .set("x-file-meta-extra-one", "1")
      .set("x-file-meta-extra-two", "2")
      .attach("upload.txt", join(__dirname, "..", "__fixtures__", "test-file-upload.txt"))
      .expect(200);

    expect(response.body).toEqual([
      {
        chunkSize: 261120,
        encoding: null,
        extraOne: 1,
        extraTwo: 2,
        filename: expect.any(String),
        hash: null,
        hashAlgorithm: null,
        length: 18,
        mimeType: "text/plain",
        name: null,
        originalName: "test-file-upload.txt",
        size: 18,
        strategy: "formidable",
        uploadDate: MockedDate.toISOString(),
      },
    ]);

    const bucket = source.bucket(TestFile);

    await expect(
      bucket.findOne({ filename: response.body[0].filename }),
    ).resolves.toEqual({
      chunkSize: 261120,
      encoding: null,
      extraOne: 1,
      extraTwo: 2,
      filename: response.body[0].filename,
      hash: null,
      hashAlgorithm: null,
      length: 18,
      mimeType: "text/plain",
      name: null,
      originalName: "test-file-upload.txt",
      size: 18,
      strategy: "formidable",
      uploadDate: MockedDate,
    });
  });
});
