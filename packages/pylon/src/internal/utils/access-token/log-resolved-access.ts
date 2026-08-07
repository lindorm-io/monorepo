import type { PylonContext } from "../../../types/index.js";

/**
 * Read from `access`, not `tokens.accessToken` — the introspected path populates
 * only the former.
 *
 * ⚠ Not called on the handshake arm: nothing has been dispatched there, so
 * `ctx.state.access` is still `null` by design and a line of `undefined`s would
 * say nothing. The handshake logs its strategy instead.
 */
export const logResolvedAccess = (ctx: PylonContext): void => {
  const access = ctx.state.access;

  ctx.logger.debug("Access token resolved", {
    provenance: access?.provenance,
    subject: access?.claims?.subject,
    subjectHint: access?.claims?.subjectHint,
  });
};
