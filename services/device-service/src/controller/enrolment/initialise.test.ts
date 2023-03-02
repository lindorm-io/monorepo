import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { initialiseEnrolmentController } from "./initialise";
import {
  createRdcSession as _createRdcSession,
  isRdcRequired as _isRdcRequired,
} from "../../handler";
import { createTestEnrolmentSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/random", () => ({
  ...(jest.requireActual("@lindorm-io/random") as object),

  randomString: () => "random-value",
}));

jest.mock("../../handler", () => ({
  createRdcSession: jest.fn(),
  isRdcRequired: jest.fn().mockResolvedValue(false),
}));

const createRdcSession = _createRdcSession as jest.Mock;
const isRdcRequired = _isRdcRequired as jest.Mock;

describe("initialiseEnrolmentController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      cache: {
        enrolmentSessionCache: createMockCache(createTestEnrolmentSession),
      },
      data: {
        brand: "brand",
        buildId: "buildId",
        buildNumber: "buildNumber",
        certificateMethod: "certificateMethod",
        macAddress: "macAddress",
        model: "model",
        publicKey: "publicKey",
        systemName: "systemName",
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          token: "jwt.jwt.jwt",
        })),
      },
      metadata: {
        client: {
          id: "clientId",
        },
        device: {
          installationId: "installationId",
          name: "name",
          uniqueId: "uniqueId",
        },
        identifiers: {
          fingerprint: "fingerprint",
        },
      },
      repository: {
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

    expect(ctx.cache.enrolmentSessionCache.create).toHaveBeenCalled();
    expect(ctx.jwt.sign).toHaveBeenCalled();
  });

  test("should resolve enrolment session with rdc", async () => {
    isRdcRequired.mockResolvedValue(true);

    await expect(initialiseEnrolmentController(ctx)).resolves.toStrictEqual({
      body: expect.objectContaining({
        externalChallengeRequired: true,
      }),
    });

    expect(ctx.cache.enrolmentSessionCache.create).toHaveBeenCalled();
    expect(createRdcSession).toHaveBeenCalled();
  });
});
