import MockDate from "mockdate";
import { rejectLoginController } from "./reject-login";
import { rejectOauthAuthenticationSession as _rejectOauthAuthenticationSession } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestLoginSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const rejectOauthAuthenticationSession = _rejectOauthAuthenticationSession as jest.Mock;

describe("rejectLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authenticationSessionCache: createMockCache(createTestAuthenticationSession),
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      entity: {
        authenticationSession: createTestAuthenticationSession(),
        loginSession: createTestLoginSession(),
      },
      deleteCookie: jest.fn(),
    };

    rejectOauthAuthenticationSession.mockResolvedValue({ redirectTo: "https://reject" });
  });

  test("should resolve", async () => {
    await expect(rejectLoginController(ctx)).resolves.toStrictEqual({ redirect: "https://reject" });

    expect(ctx.cache.authenticationSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.cache.loginSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
