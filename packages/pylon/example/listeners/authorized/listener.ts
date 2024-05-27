import { PylonListener } from "../../../src";

export const listener = new PylonListener();

listener.on("check", async (ctx) => {
  ctx.logger.debug("is-authorized", { bearer: ctx.socket.data.tokens.bearer });

  ctx.socket.emit("authorized/yes", "It's an older code sir, but it checks out.");
});
