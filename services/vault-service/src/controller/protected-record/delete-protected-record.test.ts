import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestProtectedRecord } from "../../fixtures/entity";
import { deleteProtectedRecordController } from "./delete-protected-record";

MockDate.set("2021-01-01T08:00:00.000Z");

const aesDecrypt = jest.fn();
jest.mock("@lindorm-io/crypto", () => ({
  CryptoAES: class CryptoAES {
    constructor() {}
    decrypt() {
      aesDecrypt();
    }
  },
}));

describe("deleteProtectedRecordController", () => {
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

  test("should resolve", async () => {
    await expect(deleteProtectedRecordController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.protectedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on forbidden subject", async () => {
    ctx.token.bearerToken.subject = "wrong";

    await expect(deleteProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on forbidden subject hint", async () => {
    ctx.token.bearerToken.metadata.subjectHint = "wrong";

    await expect(deleteProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should destroy and throw on invalid key", async () => {
    aesDecrypt.mockImplementation(() => {
      throw new Error("message");
    });

    await expect(deleteProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
