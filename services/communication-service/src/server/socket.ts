import { Server } from "socket.io";
import { logger } from "./logger";

export const socketListeners = (io: Server): void => {
  io.on("connection", (socket) => {
    logger.info("connection", { id: socket.id, data: socket.data });

    socket.on("test", (...args) => {
      logger.info("connection test", { id: socket.id, args });
    });

    socket.on("join_device_channel", (token) => {
      logger.info("Join device channel", { token });
    });
  });
};
