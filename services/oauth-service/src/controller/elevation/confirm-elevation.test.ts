import { AuthenticationMethod, SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestElevationRequest } from "../../fixtures/entity";
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
        elevationRequestCache: createMockRedisRepository(createTestElevationRequest),
      },
      data: {
        identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
        levelOfAssurance: 3,
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      },
      entity: {
        elevationRequest: createTestElevationRequest({
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

    expect(ctx.redis.elevationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAuthentication: {
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 3,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
        },
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should resolve without redirect", async () => {
    ctx.entity.elevationRequest = createTestElevationRequest({
      identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
      redirectUri: null,
    });

    await expect(confirmElevationController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.elevationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAuthentication: {
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 3,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
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
