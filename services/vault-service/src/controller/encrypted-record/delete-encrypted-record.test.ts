import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestEncryptedRecord } from "../../fixtures/entity";
import { getEncryptionKey as _getEncryptionKey } from "../../handler";
import { deleteEncryptedRecordController } from "./delete-encrypted-record";

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
jest.mock("../../handler");

const getEncryptionKey = _getEncryptionKey as jest.Mock;

describe("deleteEncryptedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        encryptedRecord: createTestEncryptedRecord(),
      },
      mongo: {
        encryptedRecordRepository: createMockMongoRepository(createTestEncryptedRecord),
      },
    };

    getEncryptionKey.mockReturnValue("secret");
  });

  test("should resolve", async () => {
    await expect(deleteEncryptedRecordController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.encryptedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on forbidden encryption key", async () => {
    aesDecrypt.mockImplementation(() => {
      throw new Error("message");
    });

    await expect(deleteEncryptedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
