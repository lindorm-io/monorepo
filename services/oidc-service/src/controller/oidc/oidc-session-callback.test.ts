import { createMockCache } from "@lindorm-io/redis";
import { createTestOidcSession } from "../../fixtures/entity";
import { oidcSessionCallbackController } from "./oidc-session-callback";
import {
  axiosAuthenticateOidcIdentity as _axiosAuthenticateOidcIdentity,
  axiosUpdateIdentityUserinfo as _axiosUpdateIdentityUserinfo,
  verifyOidcWithAccessToken as _verifyOidcWithAccessToken,
  verifyOidcWithCode as _verifyOidcWithCode,
  verifyOidcWithIdToken as _verifyOidcWithIdToken,
} from "../../handler";

jest.mock("../../handler");

const axiosAuthenticateOidcIdentity = _axiosAuthenticateOidcIdentity as jest.Mock;
const axiosUpdateIdentityUserinfo = _axiosUpdateIdentityUserinfo as jest.Mock;
const verifyOidcWithAccessToken = _verifyOidcWithAccessToken as jest.Mock;
const verifyOidcWithCode = _verifyOidcWithCode as jest.Mock;
const verifyOidcWithIdToken = _verifyOidcWithIdToken as jest.Mock;

describe("oidcSessionCallbackController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        oidcSessionCache: createMockCache(createTestOidcSession),
      },
      data: {
        accessToken: "access.jwt.jwt",
        code: "code",
        idToken: "id.jwt.jwt",
      },
      entity: {
        oidcSession: createTestOidcSession({
          id: "72c66ab0-fba7-4efa-97b8-9359460aff04",
        }),
      },
    };

    axiosAuthenticateOidcIdentity.mockResolvedValue({ identityId: "identityId" });
    verifyOidcWithAccessToken.mockResolvedValue({ claims: true });
    verifyOidcWithCode.mockResolvedValue({ claims: true });
    verifyOidcWithIdToken.mockResolvedValue({ claims: true });
  });

  test("should resolve", async () => {
    await expect(oidcSessionCallbackController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(axiosAuthenticateOidcIdentity).toHaveBeenCalled();
    expect(axiosUpdateIdentityUserinfo).toHaveBeenCalled();

    expect(ctx.cache.oidcSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "identityId",
        verified: true,
      }),
    );
  });

  test("should resolve URL", async () => {
    const { redirect: url } = (await oidcSessionCallbackController(ctx)) as any;

    expect(url.host).toBe("authentication.test.lindorm.io");
    expect(url.pathname).toBe("/oidc/callback");
    expect(url.searchParams.get("session_id")).toBe("72c66ab0-fba7-4efa-97b8-9359460aff04");
  });

  test("should resolve code", async () => {
    ctx.entity.oidcSession = createTestOidcSession({
      provider: "apple",
    });

    await expect(oidcSessionCallbackController(ctx)).resolves.toBeTruthy();

    expect(verifyOidcWithCode).toHaveBeenCalled();
  });

  test("should resolve id_token", async () => {
    ctx.entity.oidcSession = createTestOidcSession({
      provider: "google",
    });

    await expect(oidcSessionCallbackController(ctx)).resolves.toBeTruthy();

    expect(verifyOidcWithIdToken).toHaveBeenCalled();
  });

  test("should resolve token", async () => {
    ctx.entity.oidcSession = createTestOidcSession({
      provider: "microsoft",
    });

    await expect(oidcSessionCallbackController(ctx)).resolves.toBeTruthy();

    expect(verifyOidcWithAccessToken).toHaveBeenCalled();
  });
});
