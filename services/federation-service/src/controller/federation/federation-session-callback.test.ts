import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestFederationSession } from "../../fixtures/entity";
import {
  authenticateIdentity as _authenticateIdentity,
  resolveIdentity as _resolveIdentity,
  updateIdentityUserinfo as _updateIdentityUserinfo,
  verifyFederationWithAccessToken as _verifyFederationWithAccessToken,
  verifyFederationWithCode as _verifyFederationWithCode,
  verifyFederationWithIdToken as _verifyFederationWithIdToken,
} from "../../handler";
import { federationSessionCallbackController } from "./federation-session-callback";

jest.mock("../../handler");

const authenticateIdentity = _authenticateIdentity as jest.Mock;
const resolveIdentity = _resolveIdentity as jest.Mock;
const updateIdentityUserinfo = _updateIdentityUserinfo as jest.Mock;
const verifyFederationWithAccessToken = _verifyFederationWithAccessToken as jest.Mock;
const verifyFederationWithCode = _verifyFederationWithCode as jest.Mock;
const verifyFederationWithIdToken = _verifyFederationWithIdToken as jest.Mock;

describe("federationSessionCallbackController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        federationSessionCache: createMockRedisRepository(createTestFederationSession),
      },
      data: {
        accessToken: "access.jwt.jwt",
        code: "code",
        idToken: "id.jwt.jwt",
      },
      entity: {
        federationSession: createTestFederationSession({
          id: "72c66ab0-fba7-4efa-97b8-9359460aff04",
        }),
      },
    };

    authenticateIdentity.mockResolvedValue(undefined);
    resolveIdentity.mockImplementation(async (_, federation) =>
      createTestFederationSession({
        ...federation,
        identityId: "d50c332e-a6a7-48e5-b6c7-a6a2a14be51f",
      }),
    );
    verifyFederationWithAccessToken.mockResolvedValue({ claims: true });
    verifyFederationWithCode.mockResolvedValue({ claims: true });
    verifyFederationWithIdToken.mockResolvedValue({ claims: true });
  });

  test("should resolve", async () => {
    await expect(federationSessionCallbackController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(authenticateIdentity).toHaveBeenCalled();
    expect(updateIdentityUserinfo).toHaveBeenCalled();

    expect(ctx.redis.federationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "d50c332e-a6a7-48e5-b6c7-a6a2a14be51f",
        verified: true,
      }),
    );
  });

  test("should resolve URL", async () => {
    const { redirect: url } = (await federationSessionCallbackController(ctx)) as any;

    expect(url.host).toBe("authentication.test.lindorm.io");
    expect(url.pathname).toBe("/federation/callback");
    expect(url.searchParams.get("session")).toBe("72c66ab0-fba7-4efa-97b8-9359460aff04");
  });

  test("should resolve code", async () => {
    ctx.entity.federationSession = createTestFederationSession({
      provider: "apple",
    });

    await expect(federationSessionCallbackController(ctx)).resolves.toBeTruthy();

    expect(verifyFederationWithCode).toHaveBeenCalled();
  });

  test("should resolve id_token", async () => {
    ctx.entity.federationSession = createTestFederationSession({
      provider: "google",
    });

    await expect(federationSessionCallbackController(ctx)).resolves.toBeTruthy();

    expect(verifyFederationWithIdToken).toHaveBeenCalled();
  });

  test("should resolve token", async () => {
    ctx.entity.federationSession = createTestFederationSession({
      provider: "microsoft",
    });

    await expect(federationSessionCallbackController(ctx)).resolves.toBeTruthy();

    expect(verifyFederationWithAccessToken).toHaveBeenCalled();
  });
});
