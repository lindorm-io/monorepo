import { deleteAccountTotpController } from "./delete-account-totp";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

jest.mock("../../class", () => ({
  TOTPHandler: class TOTPHandler {
    async assert() {}
  },
}));

jest.mock("../../handler");

const vaultGetSalt = _vaultGetSalt as jest.Mock;

describe("deleteAccountTotpController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        totp: "123456",
      },
      entity: {
        account: createTestAccount(),
      },
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    vaultGetSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(deleteAccountTotpController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        totp: null,
      }),
    );
  });
});
