import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { ClientSessionType } from "../../enum";
import {
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { handleRefreshTokenGrant } from "./handle-refresh-token-grant";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../oauth");

const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestRefreshToken),
      },
      data: { refreshToken: "jwt.jwt.jwt" },
      entity: {
        client: createTestClient(),
      },
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };

    generateTokenResponse.mockResolvedValue("generateTokenResponse");
  });

  test("should resolve", async () => {
    ctx.mongo.clientSessionRepository.find.mockResolvedValue(
      createTestClientSession({
        id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        type: ClientSessionType.REFRESH,
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(generateTokenResponse).toHaveBeenCalled();
  });

  test("should throw on expired session", async () => {
    ctx.redis.opaqueTokenCache.tryFind.mockResolvedValue(
      createTestRefreshToken({
        expires: new Date("1999-01-01T01:00:00.000Z"),
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on missing session", async () => {
    ctx.mongo.clientSessionRepository.tryFind.mockResolvedValue(undefined);

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on expired session", async () => {
    ctx.mongo.clientSessionRepository.tryFind.mockResolvedValue(
      createTestClientSession({
        type: ClientSessionType.EPHEMERAL,
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });
});
