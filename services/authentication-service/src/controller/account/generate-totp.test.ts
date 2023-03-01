import { generateTotpController } from "./generate-totp";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";

jest.mock("../../class", () => ({
  TOTPHandler: class TOTPHandler {
    generate() {
      return { signature: "signature", uri: "uri" };
    }
  },
  StrategyBase: class StrategyBase {},
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
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(generateTotpController(ctx)).resolves.toStrictEqual({ body: { uri: "uri" } });

    expect(ctx.repository.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        totp: "signature",
      }),
    );
  });
});
