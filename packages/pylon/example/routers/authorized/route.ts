import { PylonRouter, useHandler } from "../../../src/index.js";

export const router = new PylonRouter();

router.get(
  "/is-authorized",
  useHandler(async (ctx) => {
    // `ctx.state.access` is the resolved credential — populated whether the
    // token was verified locally or introspected, so a handler reads one place.
    return { body: { subject: ctx.state.access?.claims.subject ?? null } };
  }),
);
