import { SessionStatus } from "../../common";
import { assertCertificateChallenge as _assertCertificateChallenge } from "../../util";
import { confirmEnrolmentController } from "./confirm";
import { createDeviceLinkCallback as createDeviceLinkCallback } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { getTestEnrolmentSession } from "../../test/entity";

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
const createDeviceCallback = createDeviceLinkCallback as jest.Mock;

describe("confirmEnrolmentController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      cache: {
        enrolmentSessionCache: createMockCache(),
      },
      data: {
        biometry: "biometry",
        certificateVerifier: "certificateVerifier",
        pincode: "pincode",
      },
      entity: {
        enrolmentSession: getTestEnrolmentSession(),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          expiresIn: 60,
          token: "jwt.jwt.jwt",
        })),
      },
      metadata: {
        client: {
          id: "clientId",
        },
      },
      repository: {
        deviceLinkRepository: createMockRepository(),
      },
      token: {
        bearerToken: {
          subject: "identityId",
        },
      },
    };

    createDeviceCallback.mockImplementation(() => "post-challenge-callback");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve enrolment session with implicit strategy", async () => {
    await expect(confirmEnrolmentController(ctx)).resolves.toStrictEqual({
      body: {
        challengeConfirmationToken: "jwt.jwt.jwt",
        deviceLinkId: expect.any(String),
        expiresIn: 60,
        trusted: true,
      },
    });

    expect(assertCertificateChallenge).toHaveBeenCalled();
    expect(ctx.repository.deviceLinkRepository.create).toHaveBeenCalled();
    expect(ctx.jwt.sign).toHaveBeenCalled();
    expect(ctx.cache.enrolmentSessionCache.destroy).toHaveBeenCalled();
  });

  test("should resolve enrolment session with trusted deviceLink", async () => {
    ctx.entity.enrolmentSession = getTestEnrolmentSession({
      status: SessionStatus.CONFIRMED,
    });

    await expect(confirmEnrolmentController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        trusted: true,
      }),
    });

    expect(ctx.repository.deviceLinkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trusted: true,
      }),
      "post-challenge-callback",
    );
  });

  test("should resolve enrolment session with non-trusted deviceLink", async () => {
    ctx.entity.enrolmentSession = getTestEnrolmentSession({
      status: SessionStatus.PENDING,
    });

    await expect(confirmEnrolmentController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        trusted: false,
      }),
    });

    expect(ctx.repository.deviceLinkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trusted: false,
      }),
      "post-challenge-callback",
    );
  });
});
