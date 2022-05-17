import { DefaultLindormSocket } from "../../types";
import { SocketError } from "../../error";

export const getSocketError = (socket: DefaultLindormSocket, err: Error): Error => {
  const error = new SocketError(err.message || "Socket Error", { error: err });
  if (socket.ctx?.logger) {
    socket.ctx.logger.error("Socket caught error", error);
  } else {
    console.error(error);
  }
  return error;
};
