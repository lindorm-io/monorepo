import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";
import { generateTotpController } from "./generate-totp";

jest.mock("../../class", () => ({
  TotpHandler: class TotpHandler {
    generate() {
      return { signature: "signature", uri: "uri" };
    }
  },
}));

jest.mock("../../handler");

const fetchAccountSalt = _fetchAccountSalt as jest.Mock;

describe("generateTotpController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        account: createTestAccount({
          totp: null,
        }),
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(generateTotpController(ctx)).resolves.toStrictEqual({ body: { uri: "uri" } });

    expect(ctx.mongo.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        totp: "signature",
      }),
    );
  });
});
