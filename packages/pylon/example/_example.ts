import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger } from "@lindorm/logger";
import { join } from "path";
import { Pylon, createHandshakeTokenMiddleware } from "../src/index.js";
import type { PylonConnectionMiddleware } from "../src/index.js";

const logger = new Logger({
  level: "silly",
  readable: true,
});

const amphora = new Amphora({
  domain: "http://test.lindorm.io",
  logger,
});

amphora.add(
  KryptosKit.generate.auto({
    algorithm: "ES256",
    issuer: "http://test.lindorm.io",
  }),
);

// Handshake auth runs on every namespace connection and rejects anonymous
// sockets, so scope it to the `/authorized` namespace — the default and
// `/other` namespaces stay open. It populates `socket.data.tokens.bearer`,
// which the `/authorized` listener reads.
const handshakeToken = createHandshakeTokenMiddleware({
  issuer: "http://test.lindorm.io",
});

const authorizedNamespaceOnly: PylonConnectionMiddleware = async (ctx, next) => {
  if (ctx.io.socket.nsp.name === "/authorized") {
    await handshakeToken(ctx, next);
    return;
  }
  await next();
};

export const EXAMPLE_PYLON = new Pylon({
  amphora,
  logger,

  environment: "test",
  name: "@lindorm/pylon",
  port: 3000,
  routes: join(import.meta.dirname, "routers"),
  socket: {
    enabled: true,
    listeners: join(import.meta.dirname, "listeners"),
    connectionMiddleware: [authorizedNamespaceOnly],
  },
  setup: async (): Promise<void> => {
    await amphora.setup();
  },
  version: "0.0.0",
});
