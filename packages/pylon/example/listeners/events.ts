import { LindormError } from "@lindorm/errors";
import { PylonListener } from "../../src";

export const listener = new PylonListener();

listener.on("names", async (ctx) => {
  ctx.socket.emit("events/list", { events: ctx.socket.eventNames() });
});

listener.on("jedi", async (ctx) => {
  ctx.logger.debug(
    "Anakin, I told you it would come to this. I was right. The Jedi are taking over!",
  );

  throw new LindormError(
    "I don't like sand. It's coarse and rough and irritating and it gets everywhere.",
  );
});
