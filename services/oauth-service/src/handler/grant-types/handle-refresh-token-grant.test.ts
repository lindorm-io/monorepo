import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestRefreshSession } from "../../fixtures/entity";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { handleRefreshTokenGrant } from "./handle-refresh-token-grant";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../oauth");

const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { refreshToken: "jwt.jwt.jwt" },
      entity: {
        client: createTestClient(),
      },
      jwt: {
        verify: jest.fn().mockImplementation(() => ({
          id: "e7d6e7a0-cc25-4a4b-b9aa-6a2019e75d56",
          session: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        })),
      },
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    generateTokenResponse.mockResolvedValue("generateTokenResponse");
  });

  test("should resolve", async () => {
    ctx.repository.refreshSessionRepository.find.mockResolvedValue(
      createTestRefreshSession({
        id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        refreshTokenId: "e7d6e7a0-cc25-4a4b-b9aa-6a2019e75d56",
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(generateTokenResponse).toHaveBeenCalled();
  });

  test("should reject on consumed session", async () => {
    ctx.repository.refreshSessionRepository.find.mockResolvedValue(
      createTestRefreshSession({
        id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should reject on expired session", async () => {
    ctx.repository.refreshSessionRepository.find.mockResolvedValue(
      createTestRefreshSession({
        id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        expires: new Date("1999-01-01T08:00:00.000Z"),
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });
});
