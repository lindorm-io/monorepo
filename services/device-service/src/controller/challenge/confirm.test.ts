import MockDate from "mockdate";
import { assertCertificateChallenge as _assertCertificateChallenge } from "../../util";
import { confirmChallengeController } from "./confirm";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestChallengeSession, createTestDeviceLink } from "../../fixtures/entity";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

const cryptoAssert = jest.fn();
jest.mock("@lindorm-io/crypto", () => ({
  CryptoLayered: class CryptoLayered {
    async assert(...args: any) {
      return cryptoAssert(...args);
    }
    async encrypt(arg: any) {
      return `${arg}-signature`;
    }
  },
}));
jest.mock("../../handler");
jest.mock("../../util");

const assertCertificateChallenge = _assertCertificateChallenge as jest.Mock;
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
          id: "524e8022-864c-4fca-a6d0-38042f69e3a9",
          biometry: "biometry-signature",
          installationId: "831a4227-db62-4160-97be-65c22023e367",
          pincode: "pincode-signature",
          uniqueId: "02aea6d6-db65-4ab9-ad0f-812cf0236b6f",
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          expiresIn: 60,
          token: "jwt.jwt.jwt",
        })),
      },
      metadata: {
        device: {
          installationId: "831a4227-db62-4160-97be-65c22023e367",
          linkId: "524e8022-864c-4fca-a6d0-38042f69e3a9",
          name: "Test DeviceLink Name",
          uniqueId: "02aea6d6-db65-4ab9-ad0f-812cf0236b6f",
        },
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: {
        challengeSessionToken: {
          session: "7af9ad76-cd7a-4738-8952-1fdc17259176",
        },
      },
    };

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
