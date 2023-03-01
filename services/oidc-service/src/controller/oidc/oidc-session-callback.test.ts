import { createMockCache } from "@lindorm-io/redis";
import { createTestOidcSession } from "../../fixtures/entity";
import { oidcSessionCallbackController } from "./oidc-session-callback";
import {
  authenticateIdentity as _authenticateIdentity,
  resolveIdentity as _resolveIdentity,
  updateIdentityUserinfo as _updateIdentityUserinfo,
  verifyOidcWithAccessToken as _verifyOidcWithAccessToken,
  verifyOidcWithCode as _verifyOidcWithCode,
  verifyOidcWithIdToken as _verifyOidcWithIdToken,
} from "../../handler";

jest.mock("../../handler");

const authenticateIdentity = _authenticateIdentity as jest.Mock;
const resolveIdentity = _resolveIdentity as jest.Mock;
const updateIdentityUserinfo = _updateIdentityUserinfo as jest.Mock;
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

    authenticateIdentity.mockResolvedValue(undefined);
    resolveIdentity.mockImplementation(async (_, oidc) =>
      createTestOidcSession({ ...oidc, identityId: "d50c332e-a6a7-48e5-b6c7-a6a2a14be51f" }),
    );
    verifyOidcWithAccessToken.mockResolvedValue({ claims: true });
    verifyOidcWithCode.mockResolvedValue({ claims: true });
    verifyOidcWithIdToken.mockResolvedValue({ claims: true });
  });

  test("should resolve", async () => {
    await expect(oidcSessionCallbackController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(authenticateIdentity).toHaveBeenCalled();
    expect(updateIdentityUserinfo).toHaveBeenCalled();

    expect(ctx.cache.oidcSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "d50c332e-a6a7-48e5-b6c7-a6a2a14be51f",
        verified: true,
      }),
    );
  });

  test("should resolve URL", async () => {
    const { redirect: url } = (await oidcSessionCallbackController(ctx)) as any;

    expect(url.host).toBe("authentication.test.lindorm.io");
    expect(url.pathname).toBe("/oidc/callback");
    expect(url.searchParams.get("session")).toBe("72c66ab0-fba7-4efa-97b8-9359460aff04");
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
