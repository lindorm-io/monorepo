import { IOServer } from "@lindorm-io/koa";
import { ServerSocket } from "../types";
import { joinDeviceChannel } from "../handler/socket";
import { winston } from "./logger";

export const socketListeners = (io: IOServer): void => {
  io.on("connection", (listener) => {
    const socket = listener as ServerSocket;
    const logger = winston
      .createChildLogger(["socket-listeners"])
      .createSessionLogger({ sockedId: socket.id });

    logger.info("connection established");

    joinDeviceChannel(socket);
  });
};
