import MockDate from "mockdate";
import { ChallengeStrategy } from "../../common";
import { assertCertificateChallenge as _assertCertificateChallenge } from "../../util";
import { confirmChallengeController } from "./confirm";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { getTestChallengeSession, getTestDeviceLink } from "../../test/entity";
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
        challengeSessionCache: createMockCache(),
      },
      data: {
        certificateVerifier: "certificateVerifier",
        pincode: "pincode",
        biometry: "biometry",
        strategy: ChallengeStrategy.IMPLICIT,
      },
      entity: {
        challengeSession: getTestChallengeSession(),
        deviceLink: await getTestDeviceLink({
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
        deviceLinkRepository: createMockRepository(),
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
    ctx.data.strategy = ChallengeStrategy.PINCODE;

    await expect(confirmChallengeController(ctx)).resolves.toBeTruthy();

    expect(cryptoAssert).toHaveBeenCalledWith("pincode", "pincode-signature");
  });

  test("should resolve challenge session with BIOMETRY", async () => {
    ctx.data.strategy = ChallengeStrategy.BIOMETRY;

    await expect(confirmChallengeController(ctx)).resolves.toBeTruthy();

    expect(cryptoAssert).toHaveBeenCalledWith("biometry", "biometry-signature");
  });
});
