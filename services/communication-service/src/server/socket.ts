import { Server } from "socket.io";
import { winston } from "./logger";

export const socketListeners = (io: Server): void => {
  io.on("connection", (socket) => {
    const logger = winston
      .createChildLogger(["socket-listeners"])
      .createSessionLogger({ sockedId: socket.id });

    logger.info("connection established");

    socket.on("test", (...args) => {
      logger.info("test event", { args });
    });

    socket.on("join_device_channel", (token) => {
      logger.info("join device channel", { token });
    });
  });
};
