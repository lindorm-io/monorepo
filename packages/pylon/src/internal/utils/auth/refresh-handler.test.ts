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

  // What happened is on the headers the MIDDLEWARE set, on every mount that runs
  // it. A body here could only be read on this one route.
  test("should answer 204 with no body when a refresh happened", async () => {
    ctx.state.sessionRefreshed = true;

    await createRefreshHandler()(ctx, async () => undefined);

    expect(ctx.status).toBe(204);
    expect(ctx.body).toBeUndefined();
  });

  // A skipped refresh is not a failure: the session is alive and the expiry it
  // went in with still stands. The headers say both.
  test("should answer 204 with no body when the refresh was skipped", async () => {
    await createRefreshHandler()(ctx, async () => undefined);

    expect(ctx.status).toBe(204);
    expect(ctx.body).toBeUndefined();
  });

  // The one thing no header can say: there is no session left. The middleware
  // destroys it when the grant fails on THIS route, and `204` would report
  // success for a request that logged the user out.
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
