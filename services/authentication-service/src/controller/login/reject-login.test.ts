import { createMockCache } from "@lindorm-io/redis";
import { getTestLoginSession } from "../../test/entity";
import { oauthRejectAuthentication as _oauthRejectAuthentication } from "../../handler";
import { rejectLoginController } from "./reject-login";

jest.mock("../../handler");

const oauthRejectAuthentication = _oauthRejectAuthentication as jest.Mock;

describe("rejectLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(),
      },
      entity: {
        loginSession: getTestLoginSession(),
      },
      deleteCookie: jest.fn(),
    };

    oauthRejectAuthentication.mockResolvedValue({
      redirectTo: "oauthRejectAuthentication",
    });
  });

  test("should resolve", async () => {
    await expect(rejectLoginController(ctx)).resolves.toStrictEqual({
      redirect: "oauthRejectAuthentication",
    });

    expect(oauthRejectAuthentication).toHaveBeenCalled();
    expect(ctx.cache.loginSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
