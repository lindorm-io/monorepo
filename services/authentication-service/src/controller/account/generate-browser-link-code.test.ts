import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { baseHash } from "@lindorm-io/core";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { generateBrowserLinkCodeController } from "./generate-browser-link-code";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),

  randomUUID: jest.fn().mockImplementation(() => "a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

jest.mock("@lindorm-io/random", () => ({
  ...jest.requireActual("@lindorm-io/random"),

  randomString: (num: number) => "1234567890".slice(0, num),
}));

jest.mock("@lindorm-io/crypto", () => ({
  ...jest.requireActual("@lindorm-io/crypto"),

  CryptoLayered: class CryptoLayered {
    async encrypt(arg: any) {
      return baseHash(arg);
    }
  },
}));

jest.mock("../../handler");

const fetchAccountSalt = _fetchAccountSalt as jest.Mock;

describe("generateBrowserLinkCodeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        account: createTestAccount({
          id: "ce43d777-8a56-4053-bc5b-8f1f5624b71c",
          browserLinkCode: null,
        }),
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(generateBrowserLinkCodeController(ctx)).resolves.toStrictEqual({
      body: { code: "12-123456-1234-123456-1234-123456" },
    });

    expect(ctx.mongo.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        browserLinkCode: "MTItMTIzNDU2LTEyMzQtMTIzNDU2LTEyMzQtMTIzNDU2",
      }),
    );
  });

  test("should reject", async () => {
    ctx.entity.account = createTestAccount({
      id: "ce43d777-8a56-4053-bc5b-8f1f5624b71c",
    });

    await expect(generateBrowserLinkCodeController(ctx)).rejects.toThrow(ClientError);
  });
});
