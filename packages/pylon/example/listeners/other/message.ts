import { PylonListener } from "../../../src";

export const listener = new PylonListener();

listener.on("hello", async (ctx) => {
  ctx.logger.debug("Ahhhh");

  ctx.socket.emit("message/response", "General Kenobi!");
});
