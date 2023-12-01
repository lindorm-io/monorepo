import { baseHash } from "@lindorm-io/core";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";
import { createPasswordController } from "./create-password";

jest.mock("@lindorm-io/crypto", () => ({
  ...jest.requireActual("@lindorm-io/crypto"),

  CryptoLayered: class CryptoLayered {
    async sign(arg: any) {
      return baseHash(arg);
    }
  },
}));

jest.mock("../../handler");

const fetchAccountSalt = _fetchAccountSalt as jest.Mock;

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
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(createPasswordController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "bmV3LXBhc3N3b3Jk",
      }),
    );
  });
});
