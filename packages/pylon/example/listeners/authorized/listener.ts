import { PylonListener } from "../../../src/index.js";

export const listener = new PylonListener({ namespace: "authorized" });

listener.on("listener/check", async (ctx) => {
  ctx.logger.debug("is-authorized", { bearer: ctx.io.socket.data.tokens.bearer });

  ctx.io.socket.emit("authorized/yes", "It's an older code sir, but it checks out.");
});
