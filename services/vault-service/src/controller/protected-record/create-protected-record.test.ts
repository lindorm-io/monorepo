import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createProtectedRecordController } from "./create-protected-record";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/crypto", () => ({
  CryptoAes: class CryptoAes {
    constructor() {}
    encrypt() {
      return "encrypted-string";
    }
  },
}));

describe("createProtectedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "id",
        data: { secret: "secret", item: "item" },
        expires: "2021-02-01T08:00:00.000+02:00",
      },
      mongo: {
        protectedRecordRepository: createMockMongoRepository(),
      },
      token: {
        bearerToken: {
          subject: "subject",
          metadata: { subjectHint: "hint" },
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(createProtectedRecordController(ctx)).resolves.toStrictEqual({
      body: { key: expect.any(String) },
      status: 201,
    });

    expect(ctx.mongo.protectedRecordRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "id",
        protectedData: "encrypted-string",
        expires: new Date("2021-02-01T08:00:00.000+02:00"),
        owner: "subject",
        ownerType: "hint",
      }),
    );
  });
});
