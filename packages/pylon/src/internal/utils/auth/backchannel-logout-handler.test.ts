import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createTestAegis } from "../../../__fixtures__/access/aegis.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import { backchannelLogoutHandler } from "./backchannel-logout-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("backchannelLogoutHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      aegis: {
        verify: vi.fn().mockResolvedValue({
          custom: {},
          claims: {
            subject: "subject",
            events: {
              "http://schemas.openid.net/event/backchannel-logout": {},
            },
          },
        }),
      },
      data: {
        logoutToken: "logoutToken",
      },
      session: {
        logout: vi.fn(),
      },
      state: {
        app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) },
        session: {
          accessToken: "accessToken",
          idToken: "idToken",
          scope: ["scope"],
          subject: "subject",
        },
      },
    };
  });

  test("forwards the deployment critical declaration to aegis", async () => {
    ctx.state.app.config = createTestAppConfig({
      auth: createTestAuthConfig({ critical: ["objectId"] }),
    });

    await backchannelLogoutHandler(ctx, vi.fn());

    expect(ctx.aegis.verify).toHaveBeenCalledWith("logoutToken", undefined, {
      critical: ["objectId"],
    });
  });

  test("a token whose crit names a declared parameter verifies through the back-channel logout path", async () => {
    ctx.aegis = createTestAegis(createMockLogger());
    ctx.state.app.config = createTestAppConfig({
      auth: createTestAuthConfig({ critical: ["objectId"] }),
    });
    ctx.data.logoutToken = (
      await ctx.aegis.sign({
        payload: {
          // `sign` is profile-less and injects no envelope claim, so the
          // issuer and expiry verify requires are stated here.
          issuer: "http://access.test.lindorm.io",
          expiresAt: new Date(Date.now() + 3600_000),
          subject: "alice",
          events: { "http://schemas.openid.net/event/backchannel-logout": {} },
        },
        header: { critical: ["objectId"], objectId: "1.2.3.4" },
      })
    ).token;

    await expect(backchannelLogoutHandler(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.status).toBe(204);
    expect(ctx.session.logout).toHaveBeenCalledWith("alice");
  });

  test("should resolve", async () => {
    await expect(backchannelLogoutHandler(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toBe(204);
  });

  test("should throw on invalid backchannel logout token", async () => {
    ctx.aegis.verify = vi.fn().mockResolvedValue({
      custom: {
        events: {},
      },
      claims: {},
    });

    await expect(backchannelLogoutHandler(ctx, vi.fn())).rejects.toThrow(ClientError);
  });

  test("should throw when the logout token carries no subject", async () => {
    ctx.aegis.verify = vi.fn().mockResolvedValue({
      custom: {
        events: {
          "http://schemas.openid.net/event/backchannel-logout": {},
        },
      },
      claims: {
        subject: undefined,
      },
    });

    await expect(backchannelLogoutHandler(ctx, vi.fn())).rejects.toThrow(ClientError);
    expect(ctx.session.logout).not.toHaveBeenCalled();
  });
});
