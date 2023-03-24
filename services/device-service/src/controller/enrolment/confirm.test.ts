import { assertCertificateChallenge as _assertCertificateChallenge } from "../../util";
import { confirmEnrolmentController } from "./confirm";
import { createDeviceLinkCallback as createDeviceLinkCallback } from "../../handler";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink, createTestEnrolmentSession } from "../../fixtures/entity";
import { SessionStatus } from "@lindorm-io/common-types";

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
      redis: {
        enrolmentSessionCache: createMockRedisRepository(createTestEnrolmentSession),
      },
      data: {
        biometry: "biometry",
        certificateVerifier: "certificateVerifier",
        pincode: "pincode",
      },
      entity: {
        enrolmentSession: createTestEnrolmentSession({
          id: "a15c8ead-157a-4cd6-ab19-46c18b38f150",
          identityId: "ec04fed7-7ecd-4f43-96b1-d23f193f1d07",
        }),
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
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: {
        bearerToken: {
          subject: "ec04fed7-7ecd-4f43-96b1-d23f193f1d07",
        },
        enrolmentSessionToken: {
          session: "a15c8ead-157a-4cd6-ab19-46c18b38f150",
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
    expect(ctx.mongo.deviceLinkRepository.create).toHaveBeenCalled();
    expect(ctx.jwt.sign).toHaveBeenCalled();
    expect(ctx.redis.enrolmentSessionCache.destroy).toHaveBeenCalled();
  });

  test("should resolve enrolment session with trusted deviceLink", async () => {
    ctx.entity.enrolmentSession = createTestEnrolmentSession({
      id: "a15c8ead-157a-4cd6-ab19-46c18b38f150",
      identityId: "ec04fed7-7ecd-4f43-96b1-d23f193f1d07",
      status: SessionStatus.CONFIRMED,
    });

    await expect(confirmEnrolmentController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        trusted: true,
      }),
    });

    expect(ctx.mongo.deviceLinkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trusted: true,
      }),
      "post-challenge-callback",
    );
  });

  test("should resolve enrolment session with non-trusted deviceLink", async () => {
    ctx.entity.enrolmentSession = createTestEnrolmentSession({
      id: "a15c8ead-157a-4cd6-ab19-46c18b38f150",
      identityId: "ec04fed7-7ecd-4f43-96b1-d23f193f1d07",
      status: SessionStatus.PENDING,
    });

    await expect(confirmEnrolmentController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        trusted: false,
      }),
    });

    expect(ctx.mongo.deviceLinkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trusted: false,
      }),
      "post-challenge-callback",
    );
  });
});
