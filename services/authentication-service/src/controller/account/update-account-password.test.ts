import { baseHash } from "@lindorm-io/core";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";
import { updateAccountPasswordController } from "./update-account-password";

jest.mock("@lindorm-io/crypto", () => ({
  ...jest.requireActual("@lindorm-io/crypto"),

  CryptoLayered: class CryptoLayered {
    async assert() {}
    async sign(arg: any) {
      return baseHash(arg);
    }
  },
}));

jest.mock("../../handler");

const fetchAccountSalt = _fetchAccountSalt as jest.Mock;

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
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(updateAccountPasswordController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "bmV3LXBhc3N3b3Jk",
      }),
    );
  });
});
