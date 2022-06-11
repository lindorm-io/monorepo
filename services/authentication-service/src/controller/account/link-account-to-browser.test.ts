import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount, createTestBrowserLink } from "../../fixtures/entity";
import { linkAccountToBrowserController } from "./link-account-to-browser";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),

  randomUUID: jest.fn().mockImplementation(() => "a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

jest.mock("@lindorm-io/core", () => ({
  ...jest.requireActual("@lindorm-io/core"),

  getRandomString: (num: number) => "1234567890".slice(0, num),
}));

jest.mock("@lindorm-io/crypto", () => ({
  ...jest.requireActual("@lindorm-io/crypto"),

  CryptoLayered: class CryptoLayered {
    async assert() {}
  },
}));

jest.mock("../../handler");

const vaultGetSalt = _vaultGetSalt as jest.Mock;

describe("linkAccountToBrowserController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        code: "code",
        password: "password",
      },
      entity: {
        account: createTestAccount({
          id: "ce43d777-8a56-4053-bc5b-8f1f5624b71c",
        }),
      },
      metadata: {
        agent: {
          browser: "agent-browser",
          os: "agent-os",
          platform: "agent-platform",
        },
        client: {
          environment: "client-environment",
        },
      },
      repository: {
        browserLinkRepository: createMockRepository(createTestBrowserLink),
      },

      setCookie: jest.fn(),
    };

    vaultGetSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(linkAccountToBrowserController(ctx)).resolves.toBeUndefined();

    expect(ctx.setCookie).toHaveBeenCalledWith(
      "lindorm_io_authentication_browser_link",
      "a26dad28-e854-447d-bce6-5c685cddfea8",
      { expiry: new Date("2120-01-01T08:00:00.000Z") },
    );
  });
});
