import { AuthorizationSession } from "../../entity";
import { getTestAuthorizationSession } from "../../test/entity";
import MockDate from "mockdate";
import { setAuthorizationCode } from "./set-authorization-code";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("setAuthorizationCode", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
    };

    authorizationSession = getTestAuthorizationSession({
      code: null,
      expires: new Date("2021-01-01T08:15:00.000Z"),
    });
  });

  test("should resolve update authorization session with code", async () => {
    await expect(setAuthorizationCode(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.objectContaining({
        code: expect.any(String),
        expires: new Date("2021-01-01T08:01:00.000Z"),
      }),
    );

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.any(AuthorizationSession),
      60,
    );
  });
});
