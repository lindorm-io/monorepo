import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { confirmAuthenticationController } from "./confirm-authentication";
import { createAuthorizationVerifyRedirectUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import { getTestAuthorizationSession, getTestBrowserSession } from "../../test/entity";
import { logger } from "../../test/logger";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("confirmAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn().mockImplementation(async (item) => item),
        },
      },
      data: {
        acrValues: ["loa_3"],
        amrValues: ["phone_otp"],
        identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
        levelOfAssurance: 3,
        remember: true,
      },
      entity: {
        authorizationSession: getTestAuthorizationSession({
          id: "49a746bf-eb34-41e8-ac8d-11716a5b76a1",
        }),
        browserSession: getTestBrowserSession({
          identityId: null,
        }),
      },
      logger,
      repository: {
        browserSessionRepository: {
          update: jest.fn().mockImplementation(async (item) => item),
        },
      },
    };

    createAuthorizationVerifyRedirectUri.mockImplementation(() => "redirect-uri");
  });

  test("should resolve", async () => {
    await expect(confirmAuthenticationController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["phone_otp"],
        expires: new Date("2021-01-31T08:00:00.000Z"),
        identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        nonce: "xkBpdx5HF1T0fiJL",
        remember: true,
      }),
    );

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationStatus: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationSession.authenticationStatus = SessionStatus.CONFIRMED;

    await expect(confirmAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid acr values", async () => {
    ctx.data.acrValues = ["wrong"];

    await expect(confirmAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid identity", async () => {
    ctx.entity.browserSession.identityId = "df4fabd0-e68c-4bb7-ac13-a4bdca53fab5";

    await expect(confirmAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
