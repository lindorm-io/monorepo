import { baseHash } from "@lindorm-io/core";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { updateAccountPasswordController } from "./update-account-password";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

jest.mock("@lindorm-io/crypto", () => ({
  ...jest.requireActual("@lindorm-io/crypto"),

  CryptoLayered: class CryptoLayered {
    async assert() {}
    async encrypt(arg: any) {
      return baseHash(arg);
    }
  },
}));

jest.mock("../../handler");

const vaultGetSalt = _vaultGetSalt as jest.Mock;

describe("updateAccountPasswordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        password: "password",
        newPassword: "new-password",
      },
      entity: {
        account: createTestAccount({
          password: "password",
        }),
      },
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    vaultGetSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(updateAccountPasswordController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "bmV3LXBhc3N3b3Jk",
      }),
    );
  });
});
