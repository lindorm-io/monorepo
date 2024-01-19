import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { createTestEnrolmentSession } from "../../fixtures/entity";
import { RSA_KEY_SET } from "../../fixtures/integration/rsa-keys.fixture";
import {
  createRdcSession as _createRdcSession,
  getDeviceHeaders as _getDeviceHeaders,
  isRdcRequired as _isRdcRequired,
} from "../../handler";
import { initialiseEnrolmentController } from "./initialise";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/random", () => ({
  ...(jest.requireActual("@lindorm-io/random") as object),

  randomString: () => "random-value",
}));

jest.mock("../../handler");

const createRdcSession = _createRdcSession as jest.Mock;
const getDeviceHeaders = _getDeviceHeaders as jest.Mock;
const isRdcRequired = _isRdcRequired as jest.Mock;

describe("initialiseEnrolmentController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      redis: {
        enrolmentSessionCache: createMockRedisRepository(createTestEnrolmentSession),
      },
      data: {
        brand: "brand",
        buildId: "buildId",
        buildNumber: "buildNumber",
        certificateMethod: "certificateMethod",
        macAddress: "macAddress",
        model: "model",
        publicKey: RSA_KEY_SET.export("pem").publicKey,
        systemName: "systemName",
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          token: "jwt.jwt.jwt",
        })),
      },
      mongo: {
        deviceLinkRepository: {
          findMany: jest.fn().mockResolvedValue([
            {
              os: "os",
              platform: "platform",
              uniqueId: "uniqueId",
            },
          ]),
        },
      },
      token: {
        bearerToken: {
          subject: "identityId",
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
    isRdcRequired.mockReturnValue(false);
  });

  afterEach(jest.clearAllMocks);

  test("should resolve enrolment session", async () => {
    await expect(initialiseEnrolmentController(ctx)).resolves.toStrictEqual({
      body: {
        certificateChallenge: "random-value",
        enrolmentSessionId: expect.any(String),
        enrolmentSessionToken: "jwt.jwt.jwt",
        expires: "2021-01-01T08:15:00.000Z",
        externalChallengeRequired: false,
      },
    });

    expect(ctx.redis.enrolmentSessionCache.create).toHaveBeenCalled();
    expect(ctx.jwt.sign).toHaveBeenCalled();
  });

  test("should resolve enrolment session with rdc", async () => {
    isRdcRequired.mockResolvedValue(true);

    await expect(initialiseEnrolmentController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        externalChallengeRequired: true,
      }),
    });

    expect(ctx.redis.enrolmentSessionCache.create).toHaveBeenCalled();
    expect(createRdcSession).toHaveBeenCalled();
  });
});
