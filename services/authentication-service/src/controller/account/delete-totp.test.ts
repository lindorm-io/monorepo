import { deleteTotpController } from "./delete-totp";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestAccount } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";

jest.mock("../../class", () => ({
  TOTPHandler: class TOTPHandler {
    async assert() {}
  },
}));

jest.mock("../../handler");

const fetchAccountSalt = _fetchAccountSalt as jest.Mock;

describe("deleteTotpController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        totp: "123456",
      },
      entity: {
        account: createTestAccount(),
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(deleteTotpController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        totp: null,
      }),
    );
  });
});
