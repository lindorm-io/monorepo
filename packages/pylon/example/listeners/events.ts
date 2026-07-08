import { LindormError } from "@lindorm/errors";
import { PylonListener } from "../../src/index.js";

export const listener = new PylonListener();

listener.on("events/names", async (ctx) => {
  ctx.io.socket.emit("events/list", { events: ["events/names", "events/jedi"] });
});

listener.on("events/jedi", async (ctx) => {
  ctx.logger.debug(
    "Anakin, I told you it would come to this. I was right. The Jedi are taking over!",
  );

  throw new LindormError(
    "I don't like sand. It's coarse and rough and irritating and it gets everywhere.",
  );
});
