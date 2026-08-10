import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger } from "@lindorm/logger";
import { join } from "path";
import { JwtDriver, Pylon, useAccessToken } from "../src/index.js";
import type { PylonConnectionMiddleware } from "../src/index.js";

const logger = new Logger({
  level: "silly",
  readable: true,
});

const amphora = new Amphora({
  internal: { issuer: "http://test.lindorm.io" },
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

// ONE middleware for every transport. Mounted as connection middleware it runs
// the handshake, rejecting anonymous sockets — so scope it to the `/authorized`
// namespace, leaving the default and `/other` namespaces open. It records what
// the connection authenticated as on `socket.data.pylon.access`, which the
// `/authorized` listener reads back off `ctx.state.access`.
//
// It takes no issuer. The driver below names a SCOPE, amphora settles the issuer
// for that scope while fetching its keys, and pylon records the answer on
// `ctx.state.app.config.auth` at boot — so no mount restates it.
const accessToken = useAccessToken();

const authorizedNamespaceOnly: PylonConnectionMiddleware = async (ctx, next) => {
  if (ctx.io.socket.nsp.name === "/authorized") {
    await accessToken(ctx, next);
    return;
  }
  await next();
};

export const EXAMPLE_PYLON = new Pylon({
  amphora,
  logger,

  // This service mints the tokens it verifies, so its issuer is amphora's own
  // and there is no upstream to authorize against — which is exactly what
  // `JwtDriver({ issuer: "self" })` says. `useAccessToken` reads the issuer
  // from here, once, rather than from each mount.
  //
  // The pairing is enforced: pylon holds the pinned scope against amphora after
  // `amphora.setup()`, so dropping `internal` above without changing the driver
  // fails `setup()` instead of every request that reaches the issuer.
  auth: {
    driver: new JwtDriver({ issuer: "self" }),
  },

  environment: "test",

  // Which vault key does what — declared per feature. `publish: false` is the
  // DEFAULT for both cookie roles (a cookie key seals what only this server
  // reopens and signs what only this server verifies), so stating it changes
  // nothing; it is written out because overriding it is then an edit rather
  // than an addition. A configured key turns that role on by default (a plain
  // `set` signs and seals).
  //
  // No `auth.session` keys: a session IS a cookie, and every session role chains
  // to its `cookies` counterpart — so this vault's two cookie keys do everything.
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
