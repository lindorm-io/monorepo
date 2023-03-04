import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { handleRefreshTokenGrant } from "./handle-refresh-token-grant";
import { ClientSessionType } from "../../enum";
import { createMockCache } from "@lindorm-io/redis";
import { resolveTokenSession as _resolveTokenSession } from "../token";
import {
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../oauth");
jest.mock("../token");

const generateTokenResponse = _generateTokenResponse as jest.Mock;
const resolveTokenSession = _resolveTokenSession as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        opaqueTokenCache: createMockCache(createTestRefreshToken),
      },
      data: { refreshToken: "jwt.jwt.jwt" },
      entity: {
        client: createTestClient(),
      },
      repository: {
        clientSessionRepository: createMockRepository(createTestClientSession),
      },
    };

    generateTokenResponse.mockResolvedValue("generateTokenResponse");
    resolveTokenSession.mockResolvedValue(createTestRefreshToken());
  });

  test("should resolve", async () => {
    ctx.repository.clientSessionRepository.find.mockResolvedValue(
      createTestClientSession({
        id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        type: ClientSessionType.REFRESH,
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(generateTokenResponse).toHaveBeenCalled();
  });

  test("should throw on expired session", async () => {
    resolveTokenSession.mockResolvedValue(
      createTestRefreshToken({
        expires: new Date("1999-01-01T01:00:00.000Z"),
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on expired session", async () => {
    ctx.repository.clientSessionRepository.find.mockResolvedValue(
      createTestClientSession({
        type: ClientSessionType.EPHEMERAL,
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });
});
