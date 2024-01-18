import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestProtectedRecord } from "../../fixtures/entity";
import { unlockProtectedRecordController } from "./unlock-protected-record";

MockDate.set("2021-01-01T08:00:00.000Z");

const aesDecrypt = jest.fn();
jest.mock("@lindorm-io/aes", () => ({
  AesCipher: class AesCipher {
    constructor() {}
    decrypt() {
      aesDecrypt();
    }
  },
}));

jest.mock("@lindorm-io/string-blob", () => ({
  parseBlob: jest.fn().mockReturnValue("parsed-blob"),
}));

describe("unlockProtectedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        key: "key",
      },
      entity: {
        protectedRecord: createTestProtectedRecord(),
      },
      mongo: {
        protectedRecordRepository: createMockMongoRepository(),
      },
      token: {
        bearerToken: {
          subject: "9168f571-2f25-4960-a585-330d1a07c094",
          metadata: { subjectHint: "client" },
        },
      },
    };
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(unlockProtectedRecordController(ctx)).resolves.toStrictEqual({
      body: {
        data: "parsed-blob",
        expires: "2023-01-01T08:00:00.000Z",
      },
    });
  });

  test("should throw on forbidden subject", async () => {
    ctx.token.bearerToken.subject = "wrong";

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on forbidden subject hint", async () => {
    ctx.token.bearerToken.metadata.subjectHint = "wrong";

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should destroy and throw on expired data", async () => {
    ctx.entity.protectedRecord.expires = new Date("2020-01-01T08:00:00.000Z");

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);

    expect(ctx.mongo.protectedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should destroy and throw on invalid key", async () => {
    aesDecrypt.mockImplementation(() => {
      throw new Error("message");
    });

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
