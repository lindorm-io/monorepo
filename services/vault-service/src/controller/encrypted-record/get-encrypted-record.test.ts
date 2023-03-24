import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { getEncryptedRecordController } from "./get-encrypted-record";
import { getEncryptionKey as _getEncryptionKey } from "../../handler";
import { createTestEncryptedRecord } from "../../fixtures/entity";
import { isAfter as _isAfter } from "date-fns";

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
jest.mock("@lindorm-io/string-blob", () => ({
  parseBlob: jest.fn().mockImplementation(() => "parsed-blob"),
}));
jest.mock("../../handler");
jest.mock("date-fns");

const getEncryptionKey = _getEncryptionKey as jest.Mock;
const isAfter = _isAfter as jest.Mock;

describe("getEncryptedRecordController", () => {
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

    getEncryptionKey.mockImplementation(() => "secret");
    isAfter.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(getEncryptedRecordController(ctx)).resolves.toStrictEqual({
      body: {
        data: "parsed-blob",
        expires: "2023-01-01T08:00:00.000Z",
      },
    });
  });

  test("should destroy and throw on expired data", async () => {
    isAfter.mockImplementation(() => true);

    await expect(getEncryptedRecordController(ctx)).rejects.toThrow(ClientError);

    expect(ctx.mongo.encryptedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on forbidden encryption key", async () => {
    aesDecrypt.mockImplementation(() => {
      throw new Error("message");
    });

    await expect(getEncryptedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
