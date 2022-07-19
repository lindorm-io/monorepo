import { IOServer } from "@lindorm-io/koa";
import { ServerSocket } from "../types";
import { joinDeviceChannel } from "../handler/socket";
import { logger as winston } from "./logger";

export const socketListeners = (io: IOServer): void => {
  io.on("connection", (listener) => {
    const socket = listener as ServerSocket;
    const logger = winston
      .createChildLogger(["socketListener"])
      .createSessionLogger({ sockedId: socket.id });

    logger.info("connection established");

    joinDeviceChannel(socket);
  });
};
