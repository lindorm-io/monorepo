import { AuthenticationMethod } from "../../enum";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { assertPKCE as _assertPKCE } from "@lindorm-io/core";
import { canGenerateMfaCookie as _canGenerateMfaCookie } from "../../util";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { generateMfaCookie as _generateMfaCookie } from "../../handler";
import { verifyAuthenticationController } from "./verify-authentication";

jest.mock("@lindorm-io/core", () => ({
  ...jest.requireActual("@lindorm-io/core"),

  assertPKCE: jest.fn(),
}));

jest.mock("../../instance", () => ({
  argon: {
    assert: jest.fn().mockImplementation(async () => {}),
  },
}));

jest.mock("../../handler");
jest.mock("../../util");

const assertPKCE = _assertPKCE as jest.Mock;
const canGenerateMfaCookie = _canGenerateMfaCookie as jest.Mock;
const generateMfaCookie = _generateMfaCookie as jest.Mock;

describe("verifyAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authenticationSessionCache: createMockCache(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          confirmedLevelOfAssurance: 3,
          confirmedMethods: [AuthenticationMethod.DEVICE_CHALLENGE],
          identityId: "9ebc4bb6-507c-4c9c-b77e-e5f8432431b7",
          loginSessionId: null,
          nonce: "nonce",
          redirectUri: null,
          status: SessionStatus.CODE,
        }),
      },
      data: {
        code: "code",
        codeVerifier: "codeVerifier",
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          expiresIn: 999,
          token: "jwt.jwt.jwt",
        })),
      },
    };

    canGenerateMfaCookie.mockImplementation(() => false);
    generateMfaCookie.mockResolvedValue(undefined);
  });

  test("should resolve", async () => {
    await expect(verifyAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        authenticationConfirmationToken: "jwt.jwt.jwt",
        expiresIn: 999,
      },
    });

    expect(assertPKCE).toHaveBeenCalled();
    expect(ctx.cache.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "verified",
      }),
    );
  });

  test("should resolve with generated mfa cookie", async () => {
    canGenerateMfaCookie.mockImplementation(() => true);

    await expect(verifyAuthenticationController(ctx)).resolves.toBeTruthy();

    expect(generateMfaCookie).toHaveBeenCalled();
  });

  test("should resolve with redirect", async () => {
    ctx.entity.authenticationSession = createTestAuthenticationSession({
      confirmedLevelOfAssurance: 3,
      confirmedMethods: [AuthenticationMethod.DEVICE_CHALLENGE],
      identityId: "9ebc4bb6-507c-4c9c-b77e-e5f8432431b7",
      loginSessionId: null,
      nonce: "nonce",
      redirectUri: "https://redirect.uri/with/route?and=query",
      status: SessionStatus.CODE,
    });

    const response = (await verifyAuthenticationController(ctx)) as any;

    expect(response.redirect).toStrictEqual(expect.any(URL));
    expect(response.redirect.toString()).toBe(
      "https://redirect.uri/with/route?and=query&authentication_confirmation_token=jwt.jwt.jwt&expires_in=999",
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.PENDING;

    await expect(verifyAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
