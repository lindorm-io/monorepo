import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { createAuthorizationVerifyRedirectUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { getTestAuthorizationSession, getTestBrowserSession } from "../../test/entity";
import { logger } from "../../test/logger";
import { skipAuthenticationController } from "./skip-authentication";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("skipAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn().mockImplementation(async (item) => item),
        },
      },
      entity: {
        authorizationSession: getTestAuthorizationSession({
          id: "49a746bf-eb34-41e8-ac8d-11716a5b76a1",
        }),
        browserSession: getTestBrowserSession(),
      },
      logger,
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
