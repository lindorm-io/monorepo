import MockDate from "mockdate";
import { initialiseLoginOidcController } from "./initialise-login-oidc";
import { createMockCache } from "@lindorm-io/redis";
import { createTestLoginSession } from "../../fixtures/entity";
import { initialiseOidcSession as _initialiseOidcSession } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const initialiseOidcSession = _initialiseOidcSession as jest.Mock;

describe("initialiseLoginOidcController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      data: {
        provider: "microsoft",
        remember: true,
      },
      entity: {
        loginSession: createTestLoginSession(),
      },
    };

    initialiseOidcSession.mockResolvedValue({ redirectTo: "https://oidc" });
  });

  test("should resolve", async () => {
    await expect(initialiseLoginOidcController(ctx)).resolves.toStrictEqual({
      redirect: "https://oidc",
    });

    expect(initialiseOidcSession).toHaveBeenCalledWith(expect.any(Object), {
      callbackUri: "https://authentication.test.lindorm.io:3100/sessions/login/oidc/callback",
      expiresAt: "2022-01-01T09:00:00.000Z",
      provider: "microsoft",
    });

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        remember: true,
      }),
    );
  });
});
