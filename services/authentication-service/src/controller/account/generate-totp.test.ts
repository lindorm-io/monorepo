import { generateTotpController } from "./generate-totp";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

jest.mock("../../class", () => ({
  TOTPHandler: class TOTPHandler {
    generate() {
      return { signature: "signature", uri: "uri" };
    }
  },
}));

jest.mock("../../handler");

const vaultGetSalt = _vaultGetSalt as jest.Mock;

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

    vaultGetSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
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
