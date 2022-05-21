import MockDate from "mockdate";
import { createEncryptedRecordController } from "./create-encrypted-record";
import { getEncryptionKey as _getEncryptionKey } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/crypto", () => ({
  CryptoAES: class CryptoAES {
    constructor() {}
    encrypt() {
      return "encrypted-string";
    }
  },
}));
jest.mock("../../handler");

const getEncryptionKey = _getEncryptionKey as jest.Mock;

describe("createEncryptedRecordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "id",
        data: { secret: "secret", item: "item" },
        expires: "2021-02-01T08:00:00.000+02:00",
      },
      repository: {
        encryptedRecordRepository: {
          create: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
    };

    getEncryptionKey.mockImplementation(() => "secret");
  });

  test("should resolve", async () => {
    await expect(createEncryptedRecordController(ctx)).resolves.toStrictEqual({
      body: {},
      status: 201,
    });

    expect(ctx.repository.encryptedRecordRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "id",
        encryptedData: "encrypted-string",
        expires: new Date("2021-02-01T08:00:00.000+02:00"),
      }),
    );
  });
});
