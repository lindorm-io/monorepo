import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import {
  createTestAuthenticationTokenSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { generateServerBearerAuthMiddleware as _generateServerBearerAuthMiddleware } from "../token";
import { handleAuthenticationTokenGrant } from "./handle-authentication-token-grant";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../oauth");
jest.mock("../token");

const generateServerBearerAuthMiddleware = _generateServerBearerAuthMiddleware as jest.Mock;
const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleAuthenticationTokenGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        authenticationClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              identityId: "b05c0f99-077e-4bde-ad3d-26c9ea270ce2",
              latestAuthentication: "2022-01-01T07:55:00.000Z",
              levelOfAssurance: 2,
              methods: ["email"],
              nonce: "afcf1aaebc8b",
            },
          }),
        },
      },
      data: {
        authenticationToken: "authenticationToken",
        scope: "openid email profile",
      },
      entity: {
        client: createTestClient(),
      },
      redis: {
        authenticationTokenSessionCache: createMockRedisRepository(
          createTestAuthenticationTokenSession,
        ),
      },
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };

    generateServerBearerAuthMiddleware.mockResolvedValue("generateServerBearerAuthMiddleware");
    generateTokenResponse.mockResolvedValue("generateTokenResponse");
  });

  test("should resolve", async () => {
    await expect(handleAuthenticationTokenGrant(ctx)).resolves.toBe("generateTokenResponse");
  });

  test("should throw on invalid scope", async () => {
    ctx.entity.client.allowed.scopes = ["openid", "email"];

    await expect(handleAuthenticationTokenGrant(ctx)).rejects.toThrow(expect.any(ClientError));
  });
});
