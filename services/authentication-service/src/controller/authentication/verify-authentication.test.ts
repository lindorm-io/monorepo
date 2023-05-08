import { AuthenticationStrategy, SessionStatus } from "@lindorm-io/common-types";
import { createMockLogger } from "@lindorm-io/core-logger";
import { ClientError } from "@lindorm-io/errors";
import { createOpaqueToken as _createOpaqueToken } from "@lindorm-io/jwt";
import { assertPKCE as _assertPKCE } from "@lindorm-io/node-pkce";
import { createMockRedisRepository } from "@lindorm-io/redis";
import {
  createTestAuthenticationConfirmationToken,
  createTestAuthenticationSession,
} from "../../fixtures/entity";
import { generateMfaCookie as _generateMfaCookie } from "../../handler";
import {
  calculateLevelOfAssurance as _calculateLevelOfAssurance,
  canGenerateMfaCookie as _canGenerateMfaCookie,
} from "../../util";
import { verifyAuthenticationController } from "./verify-authentication";

jest.mock("@lindorm-io/jwt");
jest.mock("@lindorm-io/node-pkce", () => ({
  ...jest.requireActual("@lindorm-io/node-pkce"),

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
const createOpaqueToken = _createOpaqueToken as jest.Mock;
const calculateLevelOfAssurance = _calculateLevelOfAssurance as jest.Mock;
const canGenerateMfaCookie = _canGenerateMfaCookie as jest.Mock;
const generateMfaCookie = _generateMfaCookie as jest.Mock;

describe("verifyAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authenticationConfirmationTokenCache: createMockRedisRepository(
          createTestAuthenticationConfirmationToken,
        ),
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          code: "code",
          confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
          identityId: "9ebc4bb6-507c-4c9c-b77e-e5f8432431b7",
          nonce: "nonce",
          status: SessionStatus.CODE,
        }),
      },
      data: {
        code: "code",
        codeVerifier: "codeVerifier",
      },
      logger: createMockLogger(),
    };

    calculateLevelOfAssurance.mockImplementation(() => ({
      levelOfAssurance: 3,
      maximumLevelOfAssurance: 3,
    }));
    createOpaqueToken.mockReturnValue("opaque.token");
    canGenerateMfaCookie.mockReturnValue(false);
    generateMfaCookie.mockResolvedValue(undefined);
  });

  test("should resolve", async () => {
    await expect(verifyAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        authenticationConfirmationToken: "opaque.token",
        expiresIn: 60,
      },
    });

    expect(assertPKCE).toHaveBeenCalled();
    expect(ctx.redis.authenticationSessionCache.destroy).toHaveBeenCalled();
  });

  test("should resolve with generated mfa cookie", async () => {
    canGenerateMfaCookie.mockReturnValue(true);

    await expect(verifyAuthenticationController(ctx)).resolves.toBeTruthy();

    expect(generateMfaCookie).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = "pending";

    await expect(verifyAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
