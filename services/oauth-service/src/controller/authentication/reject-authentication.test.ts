import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { getTestAuthorizationSession } from "../../test/entity";
import { logger } from "../../test/logger";
import { rejectAuthenticationController } from "./reject-authentication";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn().mockImplementation(async (item) => item),
        },
      },
      entity: {
        authorizationSession: getTestAuthorizationSession(),
      },
      logger,
    };
  });

  test("should resolve", async () => {
    await expect(rejectAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo:
          "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=authentication_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationStatus: SessionStatus.REJECTED,
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationSession.authenticationStatus = SessionStatus.SKIP;

    await expect(rejectAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
