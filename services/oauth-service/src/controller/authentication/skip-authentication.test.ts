import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { createAuthorizationVerifyRedirectUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { skipAuthenticationController } from "./skip-authentication";
import { createMockCache } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("skipAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          id: "49a746bf-eb34-41e8-ac8d-11716a5b76a1",
        }),
        browserSession: createTestBrowserSession(),
      },
      logger: createMockLogger(),
    };

    createAuthorizationVerifyRedirectUri.mockImplementation(() => "redirect-uri");
  });

  test("should resolve", async () => {
    await expect(skipAuthenticationController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationStatus: SessionStatus.SKIP,
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationSession.authenticationStatus = SessionStatus.SKIP;

    await expect(skipAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
