import { PylonListener } from "../../../src/index.js";

export const listener = new PylonListener({ namespace: "authorized" });

listener.on("listener/check", async (ctx) => {
  // The RESOLVED credential, republished on every event by the socket fast path.
  // Read it here rather than `socket.data.tokens.bearer`: a connection that
  // handshook with an OPAQUE credential has no parsed token at all.
  ctx.logger.debug("is-authorized", {
    provenance: ctx.state.access?.provenance,
    subject: ctx.state.access?.claims.subject,
  });

  ctx.io.socket.emit("authorized/yes", "It's an older code sir, but it checks out.");
});
