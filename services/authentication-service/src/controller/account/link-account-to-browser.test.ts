import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestAccount, createTestBrowserLink } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";
import { linkAccountToBrowserController } from "./link-account-to-browser";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),

  randomUUID: jest.fn().mockReturnValue("a26dad28-e854-447d-bce6-5c685cddfea8"),
}));

jest.mock("@lindorm-io/core", () => ({
  ...jest.requireActual("@lindorm-io/core"),

  randomString: (num: number) => "1234567890".slice(0, num),
}));

jest.mock("@lindorm-io/crypto", () => ({
  ...jest.requireActual("@lindorm-io/crypto"),

  CryptoLayered: class CryptoLayered {
    async assert() {}
  },
}));

jest.mock("../../handler");

const fetchAccountSalt = _fetchAccountSalt as jest.Mock;

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
      mongo: {
        browserLinkRepository: createMockMongoRepository(createTestBrowserLink),
      },
      userAgent: {
        browser: "browser",
        os: "os",
        platform: "platform",
      },
      server: {
        environment: "development",
      },

      cookies: {
        set: jest.fn(),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(linkAccountToBrowserController(ctx)).resolves.toBeUndefined();

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "lindorm_io_authentication_browser_link",
      "a26dad28-e854-447d-bce6-5c685cddfea8",
      {
        expires: new Date("2120-01-01T08:00:00.000Z"),
        httpOnly: true,
        overwrite: true,
        signed: true,
      },
    );
  });
});
