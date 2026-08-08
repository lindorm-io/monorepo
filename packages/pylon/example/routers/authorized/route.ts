import { PylonRouter, useHandler } from "../../../src/index.js";

export const router = new PylonRouter();

router.get(
  "/is-authorized",
  useHandler(async (ctx) => {
    // `ctx.state.access` is the resolved credential — populated whether the
    // token was verified locally or introspected, so a handler reads one place.
    // `custom` carries the claims the registry does not know, on both paths, and
    // is always an object. It is a plain Dict — a deployment casts to its own.
    const custom = (ctx.state.access?.custom ?? {}) as { tenantTier?: string };

    return {
      body: {
        subject: ctx.state.access?.claims.subject ?? null,
        // RFC 7662 §2.2 `username` is a registered claim, so it reads out of
        // `claims` on both paths — not out of `custom`, and not from a profile.
        username: ctx.state.access?.claims.username ?? null,
        tenantTier: custom.tenantTier ?? null,
      },
    };
  }),
);
