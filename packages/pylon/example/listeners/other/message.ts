import { PylonListener } from "../../../src/index.js";

export const listener = new PylonListener({ namespace: "other" });

listener.on("message/hello", async (ctx) => {
  ctx.logger.debug("Ahhhh");

  ctx.io.socket.emit("message/response", "General Kenobi!");
});
