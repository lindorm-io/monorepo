import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { generateTokenResponse as _generateTokenResponse } from "./generate-token-response";
import { handleRefreshTokenGrant } from "./handle-refresh-token-grant";
import { getTestClient, getTestConsentSession, getTestRefreshSession } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("./generate-token-response", () => ({
  generateTokenResponse: jest.fn().mockResolvedValue("body-response"),
}));

const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { refreshToken: "jwt.jwt.jwt" },
      entity: {
        client: getTestClient({
          id: "08bac8f5-af23-43a9-bb43-cda6cc2ec2c6",
        }),
      },
      jwt: {
        verify: jest.fn().mockImplementation(() => ({
          id: "e7d6e7a0-cc25-4a4b-b9aa-6a2019e75d56",
          sessionId: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        })),
      },
      repository: {
        consentSessionRepository: {
          find: jest.fn().mockResolvedValue(
            getTestConsentSession({
              sessions: ["5a43fe88-9a27-4e00-a0ec-f10b1464e949"],
            }),
          ),
        },
        refreshSessionRepository: {
          find: jest.fn().mockResolvedValue(
            getTestRefreshSession({
              id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
              tokenId: "e7d6e7a0-cc25-4a4b-b9aa-6a2019e75d56",
            }),
          ),
          update: jest.fn(),
          destroy: jest.fn(),
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(handleRefreshTokenGrant(ctx)).resolves.toBe("body-response");

    expect(ctx.jwt.verify).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.find).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.destroy).not.toHaveBeenCalled();
    expect(ctx.repository.consentSessionRepository.find).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.update).toHaveBeenCalled();
    expect(generateTokenResponse).toHaveBeenCalled();
  });

  test("should reject on consumed session", async () => {
    ctx.repository.refreshSessionRepository.find.mockResolvedValue(
      getTestRefreshSession({
        id: "5a43fe88-9a27-4e00-a0ec-f10b1464e949",
        tokenId: "52522c99-1274-4967-a3a3-f5de3587e325",
        expires: new Date("1999-01-01T08:00:00.000Z"),
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should reject on missing consent", async () => {
    ctx.repository.consentSessionRepository.find.mockResolvedValue(
      getTestConsentSession({
        sessions: ["6c1c1cbd-8b7e-4ea8-b7b0-a5a6a5ddaa6f"],
      }),
    );

    await expect(handleRefreshTokenGrant(ctx)).rejects.toThrow(ClientError);
  });
});
