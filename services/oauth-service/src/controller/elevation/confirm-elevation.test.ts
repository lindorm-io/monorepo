import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestElevationSession } from "../../fixtures/entity";
import {
  assertSessionPending as _assertSessionPending,
  createElevationVerifyUri as _createElevationVerifyUri,
} from "../../util";
import { confirmElevationController } from "./confirm-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const assertSessionPending = _assertSessionPending as jest.Mock;
const createElevationVerifyUri = _createElevationVerifyUri as jest.Mock;

describe("confirmElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        elevationSessionCache: createMockRedisRepository(createTestElevationSession),
      },
      data: {
        factors: [AuthenticationFactor.TWO_FACTOR],
        identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
        strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PHONE_OTP],
      },
      entity: {
        elevationSession: createTestElevationSession({
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
        }),
      },
      logger: createMockLogger(),
    };

    assertSessionPending.mockImplementation();
    createElevationVerifyUri.mockReturnValue("createElevationVerifyUri");
  });

  test("should resolve", async () => {
    await expect(confirmElevationController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createElevationVerifyUri" },
    });

    expect(ctx.redis.elevationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAuthentication: {
          factors: [AuthenticationFactor.TWO_FACTOR],
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PHONE_OTP],
        },
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should resolve without redirect", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
      redirectUri: null,
    });

    await expect(confirmElevationController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.elevationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAuthentication: {
          factors: [AuthenticationFactor.TWO_FACTOR],
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PHONE_OTP],
        },
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    ctx.data.identityId = "wrong";

    await expect(confirmElevationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid level", async () => {
    ctx.data.levelOfAssurance = 1;

    await expect(confirmElevationController(ctx)).rejects.toThrow(ClientError);
  });
});
