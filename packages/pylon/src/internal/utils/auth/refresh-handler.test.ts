import { ClientError } from "@lindorm/errors";
import { beforeEach, describe, expect, test } from "vitest";
import { createRefreshHandler } from "./refresh-handler.js";

describe("createRefreshHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      state: {
        session: {
          id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e",
          expiresAt: new Date("2024-01-01T20:00:00.000Z"),
        },
        sessionRefreshed: false,
      },
    };
  });

  test("should report a refresh with the new expiry", async () => {
    ctx.state.sessionRefreshed = true;

    await createRefreshHandler()(ctx, async () => undefined);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      refreshed: true,
      expiresAt: new Date("2024-01-01T20:00:00.000Z"),
    });
  });

  // A skipped refresh is not a failure: the session is alive and the expiry it
  // went in with still stands. Saying so is the whole point of the route.
  test("should report a skip with the original expiry", async () => {
    await createRefreshHandler()(ctx, async () => undefined);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({
      refreshed: false,
      expiresAt: new Date("2024-01-01T20:00:00.000Z"),
    });
  });

  // A session with no deadline of its own. `expiresAt: null` has to mean THIS
  // and only this, which is why a destroyed session cannot also report it.
  test("should report a null expiry for a session with no deadline", async () => {
    ctx.state.session.expiresAt = null;

    await createRefreshHandler()(ctx, async () => undefined);

    expect(ctx.body).toEqual({ refreshed: false, expiresAt: null });
  });

  // The middleware deletes the session when the grant fails. `200 { refreshed:
  // false, expiresAt: null }` would be indistinguishable from the test above,
  // and a caller choosing between "call again later" and "re-authenticate"
  // cannot be handed one body for both.
  test("should answer 401 when the middleware destroyed the session", async () => {
    ctx.state.session = null;

    await expect(createRefreshHandler()(ctx, async () => undefined)).rejects.toThrow(
      ClientError,
    );
  });

  test("should answer 401 with refresh_session_required", async () => {
    ctx.state.session = null;

    await expect(
      createRefreshHandler()(ctx, async () => undefined),
    ).rejects.toMatchObject({
      code: "refresh_session_required",
      status: 401,
    });
  });
});
