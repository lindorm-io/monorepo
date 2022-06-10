import MockDate from "mockdate";
import { baseHash } from "@lindorm-io/core";
import { generateBrowserLinkCodeController } from "./generate-browser-link-code";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";
import { ClientError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/core", () => ({
  ...jest.requireActual("@lindorm-io/core"),

  getRandomString: (num: number) => "1234567890".slice(0, num),
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

const vaultGetSalt = _vaultGetSalt as jest.Mock;

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
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },

      getCookie: jest.fn().mockImplementation(() => null),
      setCookie: jest.fn(),
    };

    vaultGetSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(generateBrowserLinkCodeController(ctx)).resolves.toStrictEqual({
      body: { code: "12-123456-1234-12345678-1234" },
    });

    expect(ctx.repository.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        browserLinkCode: "MTItMTIzNDU2LTEyMzQtMTIzNDU2NzgtMTIzNA==",
      }),
    );

    expect(ctx.setCookie).toHaveBeenCalledWith(
      "lindorm_io_authentication_browser_link",
      "ce43d777-8a56-4053-bc5b-8f1f5624b71c",
      { expiry: new Date("2120-01-01T08:00:00.000Z") },
    );
  });

  test("should resolve with existing browser link code", async () => {
    ctx.entity.account = createTestAccount({
      id: "ce43d777-8a56-4053-bc5b-8f1f5624b71c",
    });
    ctx.getCookie.mockImplementation(() => "ce43d777-8a56-4053-bc5b-8f1f5624b71c");

    await expect(generateBrowserLinkCodeController(ctx)).resolves.toBeTruthy();
  });

  test("should reject", async () => {
    ctx.entity.account = createTestAccount({
      id: "ce43d777-8a56-4053-bc5b-8f1f5624b71c",
    });
    ctx.getCookie.mockImplementation(() => "13a23b49-e42a-4097-a7c0-7b5c23a7a0d0");

    await expect(generateBrowserLinkCodeController(ctx)).rejects.toThrow(ClientError);
  });
});
