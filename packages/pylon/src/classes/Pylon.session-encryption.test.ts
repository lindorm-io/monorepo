// Whether a session-enabled deployment seals the tokens it holds, held at BOOT
// against what the deployment actually configured — driven through a real
// `Pylon.setup()` rather than the validator alone, because the point of the rule
// is that a misconfigured deployment cannot start.
//
// The severity splits on the `kv` source, because that decides what the session
// COOKIE carries. With a store it is an opaque id; without one it is the whole
// session object — access token, id token, refresh token — base64url encoded and
// re-sent on every request.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { ProteusSource } from "@lindorm/proteus";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { IDP_SETTINGS, nockIdp } from "../__fixtures__/idp.js";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import { OpenIdResourceDriver } from "../drivers/auth/OpenIdResourceDriver.js";
import { PylonError } from "../errors/PylonError.js";
import type { PylonEncKey, PylonSettings } from "../types/index.js";
import { Pylon } from "./Pylon.js";

const ISSUER = "http://test.lindorm.io";

const SESSION_KEY: PylonEncKey = {
  condition: { purpose: "pylon:kek", publish: false },
};

const WARNING = "auth.session.encryption";

// `OpenIdResourceDriver` pins `amphora.idp`, so these deployments need a real
// upstream registered — a pylon that boots without one does not exist.
nockIdp();

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

let pylons: Array<Pylon> = [];
let sources: Array<ProteusSource> = [];

afterEach(async () => {
  for (const pylon of pylons) {
    await pylon.stop().catch(() => undefined);
  }
  for (const source of sources) {
    await source.disconnect().catch(() => undefined);
  }
  pylons = [];
  sources = [];
});

const createAmphora = (logger: ILogger): IAmphora => {
  const amphora = new Amphora({
    internal: { issuer: ISSUER },
    idp: IDP_SETTINGS,
    logger,
  });
  const kek: IKryptos = KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    publish: false,
    purpose: "pylon:kek",
  });
  amphora.add([kek]);
  return amphora;
};

const createKv = (amphora: IAmphora, logger: ILogger): ProteusSource => {
  const source = new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities: [] as never,
    logger,
    synchronize: true,
    amphora,
  });
  sources.push(source);
  return source;
};

type Options = {
  /** The warnings + errors every logger in the tree funnels into. */
  logged: Array<string>;
  kv?: boolean;
  sessionKey?: PylonEncKey;
  cookieKey?: PylonEncKey;
};

const createPylon = (options: Options): Pylon => {
  // `logger.child()` hands back a NEW mock, so the root mock's `warn` never sees
  // what Pylon logs through its child. The log CALLBACK is inherited by every
  // child, which is what makes a whole-tree count possible.
  const logger = createMockLogger((...args: Array<unknown>) => {
    options.logged.push(String(args[0]));
  });

  const amphora = createAmphora(logger);

  const settings: PylonSettings = {
    logger,
    amphora,
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon-session-encryption-test",
    port: 0,
    version: "0.0.1",
    auth: {
      driver: new OpenIdResourceDriver({ clientId: "client-id" }),
      session: options.sessionKey
        ? { enabled: true, encryption: options.sessionKey }
        : { enabled: true },
    },
  };

  if (options.cookieKey) {
    settings.cookies = { encryption: options.cookieKey };
  }

  if (options.kv) {
    settings.kv = createKv(amphora, logger) as any;
  }

  const pylon = new Pylon(settings);
  pylons.push(pylon);
  return pylon;
};

const countWarnings = (logged: Array<string>): number =>
  logged.filter((line) => line.includes(WARNING)).length;

describe("Pylon session encryption", () => {
  describe("cookie-only (no kv source)", () => {
    // The cookie IS the token set. There is no degraded mode to run in.
    test("should refuse to boot when no key resolves on either tier", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged });

      await expect(pylon.setup()).rejects.toThrow(PylonError);
    });

    test("should name the settings to add", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged });

      await expect(pylon.setup()).rejects.toMatchObject({
        code: "session_encryption_not_configured",
        details: expect.stringContaining("auth.session.encryption"),
      });
    });

    test("should boot on the session's own key", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged, sessionKey: SESSION_KEY });

      await expect(pylon.setup()).resolves.toBeUndefined();

      expect(countWarnings(logged)).toBe(0);
    });

    // `session.encryption ?? cookies.encryption` — naming ONE key for every
    // cookie is the documented convenience, and it satisfies this rule.
    test("should boot on an inherited cookies key", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged, cookieKey: SESSION_KEY });

      await expect(pylon.setup()).resolves.toBeUndefined();

      expect(countWarnings(logged)).toBe(0);
    });
  });

  describe("kv-backed", () => {
    // The cookie carries an opaque id; the tokens sit behind the store's own
    // access boundary. Weaker, but a workable deployment — so it warns and runs.
    test("should boot with a warning when no key resolves", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged, kv: true });

      await expect(pylon.setup()).resolves.toBeUndefined();

      expect(countWarnings(logged)).toBe(1);
    });

    test("should stay silent when a key resolves", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged, kv: true, sessionKey: SESSION_KEY });

      await expect(pylon.setup()).resolves.toBeUndefined();

      expect(countWarnings(logged)).toBe(0);
    });

    // ⚠ Boot config, warned about at BOOT. A per-request repeat of a static
    // configuration warning is noise that teaches operators to filter warnings —
    // and the session middleware runs on every request, so this is not free.
    test("should warn ONCE, not per request", async () => {
      const logged: Array<string> = [];
      const pylon = createPylon({ logged, kv: true });

      await pylon.setup();

      expect(countWarnings(logged)).toBe(1);

      await loopback.request(pylon.callback).get("/health").expect(204);
      await loopback.request(pylon.callback).get("/health").expect(204);
      await loopback.request(pylon.callback).get("/health").expect(204);

      expect(countWarnings(logged)).toBe(1);
    });
  });
});
