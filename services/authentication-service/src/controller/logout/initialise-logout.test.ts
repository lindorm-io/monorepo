import MockDate from "mockdate";
import { ClientType } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createTestLogoutSession } from "../../fixtures/entity";
import { getExpires } from "@lindorm-io/core";
import { initialiseLogoutController } from "./initialise-logout";
import {
  confirmOauthLogoutSession as _confirmOauthLogoutSession,
  fetchOauthLogoutInfo as _fetchOauthLogoutInfo,
} from "../../handler";

MockDate.set("2020-01-01T08:00:15.000");

jest.mock("../../handler");

const fetchOauthLogoutInfo = _fetchOauthLogoutInfo as jest.Mock;
const confirmOauthLogoutSession = _confirmOauthLogoutSession as jest.Mock;

describe("initialiseLogoutController", () => {
  let ctx: any;
  let info: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(createTestLogoutSession),
      },
      data: { sessionId: "sessionId" },
      setCookie: jest.fn(),
    };

    const { expires, expiresIn } = getExpires(new Date("2022-01-01T08:00:00.000Z"));

    info = {
      client: {
        name: "name",
        logoUri: "logoUri",
        description: "description",
        type: ClientType.PUBLIC,
      },
      logoutSession: {
        expiresAt: expires.toISOString(),
        expiresIn,
      },
    };

    fetchOauthLogoutInfo.mockResolvedValue(info);
    confirmOauthLogoutSession.mockResolvedValue({ redirectTo: "confirmOauthLogoutSession" });
  });

  test("should resolve", async () => {
    await expect(initialiseLogoutController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.cache.logoutSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: new Date("2022-01-01T08:00:00.000Z"),
      }),
      expect.any(Number),
    );
    expect(ctx.setCookie).toHaveBeenCalled();
  });

  test("should resolve confirm", async () => {
    info.client.type = ClientType.CONFIDENTIAL;

    await expect(initialiseLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "confirmOauthLogoutSession",
    });
  });
});
