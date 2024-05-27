import { Conduit } from "@lindorm/conduit";
import { Logger, LogLevel } from "@lindorm/logger";
import io from "socket.io-client";
import { EXAMPLE_PYLON } from "./_example";

const logger = new Logger({ level: LogLevel.Silly, readable: true });

const main = async (): Promise<void> => {
  await EXAMPLE_PYLON.start();

  const conduit = new Conduit({
    baseUrl: "http://127.0.0.1:3000",
    logger,
  });

  const token = await conduit.get("/test/authorize");

  const socket = io("http://127.0.0.1:3000", {
    extraHeaders: {
      "x-correlation-id": "test-correlation-id",
    },
  });

  socket.on("connect", () => {
    logger.info("Client is connected to server", {
      id: socket.id,
      connected: socket.connected,
    });

    logger.info("emitting events/names");
    socket.emit("events/names");

    logger.info("emitting events/jedi");
    socket.emit("events/jedi", { args_is_a_camel_case_object_now: true });
  });

  socket.on("events/list", (data) => {
    logger.info("Client received events from server", { data });
  });

  socket.on("error", (data) => {
    logger.error("Client received error from server", { data });
  });

  socket.connect();

  const authorizedSocket = io("http://127.0.0.1:3000/authorized", {
    auth: { bearer: token.data.token.token },
  });

  authorizedSocket.on("connect", () => {
    logger.info("Client is connected to server", {
      id: authorizedSocket.id,
      connected: authorizedSocket.connected,
    });

    logger.info("emitting listener/check");
    authorizedSocket.emit("listener/check");
  });

  authorizedSocket.on("authorized/yes", (data) => {
    logger.info("Client received authorized from server", { data });
  });

  authorizedSocket.connect();

  const otherSocket = io("http://127.0.0.1:3000/other");

  otherSocket.on("connect", () => {
    logger.info("Client is connected to server", {
      id: otherSocket.id,
      connected: otherSocket.connected,
    });

    logger.info("emitting message/hello");
    otherSocket.emit("message/hello", "There!");
  });

  otherSocket.on("message/response", (data) => {
    logger.info("Client received response from server", { data });
  });

  otherSocket.connect();
};

main().catch(console.error);
