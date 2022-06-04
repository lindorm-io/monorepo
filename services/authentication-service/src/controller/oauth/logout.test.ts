import MockDate from "mockdate";
import { ClientType } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { getExpires } from "@lindorm-io/core";
import { oauthLogoutController } from "./logout";
import {
  oauthConfirmLogout as _oauthConfirmLogout,
  oauthGetLogoutSessionInfo as _oauthGetLogoutSessionInfo,
} from "../../handler";

MockDate.set("2020-01-01T08:00:15.000");

jest.mock("../../handler");

const oauthGetLogoutSessionInfo = _oauthGetLogoutSessionInfo as jest.Mock;
const oauthConfirmLogout = _oauthConfirmLogout as jest.Mock;

describe("oauthLogoutController", () => {
  let ctx: any;
  let info: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(),
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

    oauthGetLogoutSessionInfo.mockResolvedValue(info);
    oauthConfirmLogout.mockResolvedValue({ redirectTo: "oauthConfirmLogout" });
  });

  test("should resolve", async () => {
    await expect(oauthLogoutController(ctx)).resolves.toStrictEqual({
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

    await expect(oauthLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmLogout",
    });
  });
});
