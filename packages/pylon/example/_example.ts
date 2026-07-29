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

// The PUBLISHED token key — the one an RP sees in the JWKS.
amphora.add(
  KryptosKit.generate.auto({
    algorithm: "ES256",
    issuer: "http://test.lindorm.io",
    publish: true,
    purpose: "token",
  }),
);

// The INTERNAL cookie keys — they never leave the server, so they are never
// published. `keys` below names them; pylon guesses nothing.
amphora.add([
  KryptosKit.generate.auto({
    algorithm: "HS256",
    issuer: "http://test.lindorm.io",
    publish: false,
    purpose: "cookie",
  }),
  KryptosKit.generate.auto({
    algorithm: "dir",
    issuer: "http://test.lindorm.io",
    publish: false,
    purpose: "cookie",
  }),
]);

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

  // Which vault key does what — declared per feature. `publish: false` is
  // load-bearing: amphora's default query is the PUBLISHED set, so an internal
  // key is otherwise unreachable and the JWKS token key would win. A configured
  // key turns that role on by default (a plain `set` signs and seals).
  //
  // No `session` keys: a session IS a cookie, and every session role chains to
  // its `cookies` counterpart — so this vault's two cookie keys do everything.
  // No `verification` either: it derives from the signing condition.
  cookies: {
    signature: { condition: { purpose: "cookie", publish: false } },
    encryption: { condition: { purpose: "cookie", publish: false } },
  },

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
