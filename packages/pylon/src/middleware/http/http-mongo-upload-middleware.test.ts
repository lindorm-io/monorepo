import { createMockAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import MockDate from "mockdate";
import { join } from "path";
import request from "supertest";
import { TestUploadOne } from "../../__fixtures__/files/test-upload-one";
import { Pylon, PylonRouter } from "../../classes";
import { PylonHttpContext, PylonOptions } from "../../types";
import { createHttpMongoUploadMiddleware } from "./http-mongo-upload-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("createHttpMongoUploadMiddleware", () => {
  let source: IMongoSource;
  let options: PylonOptions;
  let router: PylonRouter;

  beforeAll(async () => {
    const amphora = createMockAmphora();
    const logger = createMockLogger();

    source = new MongoSource({
      files: [TestUploadOne],
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
      database: "test_database",
    });

    await source.setup();

    router = new PylonRouter<PylonHttpContext>();

    router.post(
      "/upload",
      createHttpMongoUploadMiddleware(TestUploadOne),
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
      sources: [source],
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
      .attach("upload.txt", join(__dirname, "..", "..", "__fixtures__", "upload.txt"))
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
        length: 9,
        mimeType: "text/plain",
        name: null,
        originalName: "upload.txt",
        size: null,
        strategy: "busboy",
        uploadDate: MockedDate.toISOString(),
      },
    ]);

    const bucket = source.bucket(TestUploadOne);

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
      length: 9,
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
      .attach("upload.txt", join(__dirname, "..", "..", "__fixtures__", "upload.txt"))
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
        length: 9,
        mimeType: "text/plain",
        name: null,
        originalName: "upload.txt",
        size: 9,
        strategy: "formidable",
        uploadDate: MockedDate.toISOString(),
      },
    ]);

    const bucket = source.bucket(TestUploadOne);

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
      length: 9,
      mimeType: "text/plain",
      name: null,
      originalName: "upload.txt",
      size: 9,
      strategy: "formidable",
      uploadDate: MockedDate,
    });
  });
});
