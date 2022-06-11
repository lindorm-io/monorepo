import { baseHash } from "@lindorm-io/core";
import { createPasswordController } from "./create-password";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

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

describe("createAccountPasswordController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        newPassword: "new-password",
      },
      entity: {
        account: createTestAccount({ password: null }),
      },
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    vaultGetSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(createPasswordController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "bmV3LXBhc3N3b3Jk",
      }),
    );
  });
});
