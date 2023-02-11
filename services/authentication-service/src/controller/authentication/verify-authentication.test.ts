import { ClientError } from "@lindorm-io/errors";
import { assertPKCE as _assertPKCE } from "@lindorm-io/node-pkce";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { generateMfaCookie as _generateMfaCookie } from "../../handler";
import { verifyAuthenticationController } from "./verify-authentication";
import {
  calculateLevelOfAssurance as _calculateLevelOfAssurance,
  canGenerateMfaCookie as _canGenerateMfaCookie,
} from "../../util";

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
const calculateLevelOfAssurance = _calculateLevelOfAssurance as jest.Mock;
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
          code: "code",
          confirmedStrategies: ["device_challenge"],
          identityId: "9ebc4bb6-507c-4c9c-b77e-e5f8432431b7",
          nonce: "nonce",
          status: "code",
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

    calculateLevelOfAssurance.mockImplementation(() => ({
      levelOfAssurance: 3,
      maximumLevelOfAssurance: 3,
    }));
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
    expect(ctx.cache.authenticationSessionCache.destroy).toHaveBeenCalled();
  });

  test("should resolve with generated mfa cookie", async () => {
    canGenerateMfaCookie.mockImplementation(() => true);

    await expect(verifyAuthenticationController(ctx)).resolves.toBeTruthy();

    expect(generateMfaCookie).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = "pending";

    await expect(verifyAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
