import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import {
  createTestChallengeSession,
  createTestDeviceLink,
  createTestPublicKey,
} from "../../fixtures/entity";
import {
  getDeviceHeaders as _getDeviceHeaders,
  vaultGetSalt as _vaultGetSalt,
} from "../../handler";
import { assertCertificateChallenge as _assertCertificateChallenge } from "../../util";
import { confirmChallengeController } from "./confirm";

MockDate.set("2021-01-01T08:00:00.000Z");

const cryptoAssert = jest.fn();
jest.mock("@lindorm-io/crypto", () => ({
  CryptoLayered: class CryptoLayered {
    async assert(...args: any) {
      return cryptoAssert(...args);
    }
    async sign(arg: any) {
      return `${arg}-signature`;
    }
  },
}));
jest.mock("../../handler");
jest.mock("../../util");

const assertCertificateChallenge = _assertCertificateChallenge as jest.Mock;
const getDeviceHeaders = _getDeviceHeaders as jest.Mock;
const vaultGetSalt = _vaultGetSalt as jest.Mock;

describe("confirmChallengeController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      redis: {
        challengeSessionCache: createMockRedisRepository(createTestChallengeSession),
      },
      data: {
        certificateVerifier: "certificateVerifier",
        pincode: "pincode",
        biometry: "biometry",
        strategy: "implicit",
      },
      entity: {
        challengeSession: createTestChallengeSession({
          id: "7af9ad76-cd7a-4738-8952-1fdc17259176",
        }),
        deviceLink: createTestDeviceLink({
          id: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
          biometry: "biometry-signature",
          installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
          pincode: "pincode-signature",
          publicKeyId: "30bc624c-acea-4afc-a711-efe479bc0000",
          uniqueId: "474aacfa09474d4caaf903977b896213",
        }),
        publicKey: createTestPublicKey({
          id: "30bc624c-acea-4afc-a711-efe479bc0000",
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          expiresIn: 60,
          token: "jwt.jwt.jwt",
        })),
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: {
        challengeSessionToken: {
          metadata: { session: "7af9ad76-cd7a-4738-8952-1fdc17259176" },
        },
      },
    };

    getDeviceHeaders.mockReturnValue({
      installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
      linkId: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
      name: "name",
      systemVersion: "1.0.0",
      uniqueId: "474aacfa09474d4caaf903977b896213",
    });
    vaultGetSalt.mockResolvedValue({
      aes: "aes",
      sha: "sha",
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve challenge session with IMPLICIT", async () => {
    await expect(confirmChallengeController(ctx)).resolves.toStrictEqual({
      body: {
        challengeConfirmationToken: "jwt.jwt.jwt",
        expiresIn: 60,
      },
    });

    expect(assertCertificateChallenge).toHaveBeenCalled();
    expect(cryptoAssert).not.toHaveBeenCalled();
    expect(ctx.jwt.sign).toHaveBeenCalled();
    expect(ctx.redis.challengeSessionCache.destroy).toHaveBeenCalled();
  });

  test("should resolve challenge session with PINCODE", async () => {
    ctx.data.strategy = "pincode";

    await expect(confirmChallengeController(ctx)).resolves.toBeTruthy();

    expect(cryptoAssert).toHaveBeenCalledWith("pincode", "pincode-signature");
  });

  test("should resolve challenge session with BIOMETRY", async () => {
    ctx.data.strategy = "biometry";

    await expect(confirmChallengeController(ctx)).resolves.toBeTruthy();

    expect(cryptoAssert).toHaveBeenCalledWith("biometry", "biometry-signature");
  });
});
