import MockDate from "mockdate";
import { assertCertificateChallenge as _assertCertificateChallenge } from "../../util";
import { confirmChallengeController } from "./confirm";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
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
      cache: {
        challengeSessionCache: createMockCache(createTestChallengeSession),
      },
      data: {
        certificateVerifier: "certificateVerifier",
        pincode: "pincode",
        biometry: "biometry",
        strategy: "implicit",
      },
      entity: {
        challengeSession: createTestChallengeSession(),
        deviceLink: createTestDeviceLink({
          pincode: "pincode-signature",
          biometry: "biometry-signature",
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
          name: "Test DeviceLink Name",
        },
      },
      repository: {
        deviceLinkRepository: createMockRepository(createTestDeviceLink),
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
    expect(ctx.cache.challengeSessionCache.destroy).toHaveBeenCalled();
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
