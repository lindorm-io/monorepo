import { baseHash } from "@lindorm-io/core";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestAccount } from "../../fixtures/entity";
import { fetchAccountSalt as _fetchAccountSalt } from "../../handler";
import { generateRecoveryCodeController } from "./generate-recovery-code";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/random", () => ({
  ...jest.requireActual("@lindorm-io/random"),

  randomString: (num: number) => "1234567890".slice(0, num),
}));

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

describe("generateRecoveryCodeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        account: createTestAccount({
          recoveryCode: null,
        }),
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    fetchAccountSalt.mockResolvedValue({ aes: "aes-salt", sha: "sha-salt" });
  });

  test("should resolve", async () => {
    await expect(generateRecoveryCodeController(ctx)).resolves.toStrictEqual({
      body: { code: "123456-123456-123456-123456" },
    });

    expect(ctx.mongo.accountRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveryCode: "MTIzNDU2LTEyMzQ1Ni0xMjM0NTYtMTIzNDU2",
      }),
    );
  });
});
