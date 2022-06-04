import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockRepository } from "@lindorm-io/mongo";
import { getTestProtectedRecord } from "../../test/entity";
import { isAfter as _isAfter } from "date-fns";
import { unlockProtectedRecordController } from "./unlock-protected-record";

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
jest.mock("date-fns");

const isAfter = _isAfter as jest.Mock;

describe("unlockProtectedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        key: "key",
      },
      entity: {
        protectedRecord: getTestProtectedRecord(),
      },
      repository: {
        protectedRecordRepository: createMockRepository(),
      },
      token: {
        bearerToken: {
          subject: "9168f571-2f25-4960-a585-330d1a07c094",
          subjectHint: "client",
        },
      },
    };

    isAfter.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(unlockProtectedRecordController(ctx)).resolves.toStrictEqual({
      body: {
        data: "parsed-blob",
        expires: new Date("2023-01-01T08:00:00.000Z"),
      },
    });
  });

  test("should throw on forbidden subject", async () => {
    ctx.token.bearerToken.subject = "wrong";

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on forbidden subject hint", async () => {
    ctx.token.bearerToken.subjectHint = "wrong";

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });

  test("should destroy and throw on expired data", async () => {
    isAfter.mockImplementation(() => true);

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);

    expect(ctx.repository.protectedRecordRepository.destroy).toHaveBeenCalled();
  });

  test("should destroy and throw on invalid key", async () => {
    aesDecrypt.mockImplementation(() => {
      throw new Error("message");
    });

    await expect(unlockProtectedRecordController(ctx)).rejects.toThrow(ClientError);
  });
});
