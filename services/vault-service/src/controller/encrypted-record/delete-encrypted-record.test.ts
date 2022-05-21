import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { deleteEncryptedRecordController } from "./delete-encrypted-record";
import { getEncryptionKey as _getEncryptionKey } from "../../handler";
import { getTestEncryptedRecord } from "../../test/entity";

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
jest.mock("../../handler");

const getEncryptionKey = _getEncryptionKey as jest.Mock;

describe("deleteEncryptedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        encryptedRecord: getTestEncryptedRecord(),
      },
      repository: {
        encryptedRecordRepository: {
          destroy: jest.fn().mockResolvedValue(undefined),
        },
      },
    };

    getEncryptionKey.mockImplementation(() => "secret");
  });

  test("should resolve", async () => {
    await expect(deleteEncryptedRecordController(ctx)).resolves.toStrictEqual({});

    expect(ctx.repository.encryptedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on forbidden encryption key", async () => {
    aesDecrypt.mockImplementation(() => {
      throw new Error("message");
    });

    await expect(deleteEncryptedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
