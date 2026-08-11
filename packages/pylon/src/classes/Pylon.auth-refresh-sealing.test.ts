// What the SESSION STORE hands upstream after an opportunistic refresh, through
// the REAL auth router — real refresh middleware, real driver, real kv-backed
// encrypted store, real cookie.
//
// `store.set` used to seal the tokens by writing the ciphertext back onto the
// session object it was GIVEN. The refresh middleware hands it
// `ctx.state.session`, and `ctx.auth.introspect()` / `.userinfo()` resolve their
// credential off `ctx.state.session.accessToken` LATER, inside the handler — so
// the value they read was the `aes:` blob, not a token. Pylon sent it upstream
// as a bearer credential.
//
// The tokens here are OPAQUE on purpose. A JWT is intercepted by the local
// fast paths in `createClaimsClient` (the parsed `ctx.state.tokens` buckets), so
// the driver is never reached and the sealed string never leaves the process.
// An opaque credential is the shape that has to go to the provider — which is
// exactly the shape that was corrupted.

import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import { Session } from "../entities/Session.js";
import type { IPylonAuthDriver } from "../interfaces/index.js";
import type {
  PylonAuthTokenResult,
  PylonIntrospection,
  PylonUserinfo,
} from "../types/index.js";
import { Pylon } from "./Pylon.js";
import { PylonRouter } from "./PylonRouter.js";

const ISSUER = "http://auth-sealing.test.lindorm.io";

/** The credentials the seeded session starts with — opaque, not JWTs. */
const SEEDED_ACCESS_TOKEN = "opaque-access-token-seeded";
const SEEDED_ID_TOKEN = "opaque-id-token-seeded";
const SEEDED_REFRESH_TOKEN = "opaque-refresh-token-seeded";

/** What the refresh grant hands back — deliberately different strings. */
const REFRESHED_ACCESS_TOKEN = "opaque-access-token-refreshed";
const REFRESHED_REFRESH_TOKEN = "opaque-refresh-token-refreshed";

/** Every token string the driver was handed, in call order. */
type DriverCalls = {
  introspect: Array<string>;
  userinfo: Array<string>;
};

const createDriver = (calls: DriverCalls): IPylonAuthDriver => ({
  clientId: "client-id",
  issuerScope: "none",

  endpoints: () => ({
    issuer: ISSUER,
    authorizationEndpoint: `${ISSUER}/authorize`,
    tokenEndpoint: `${ISSUER}/token`,
    userinfoEndpoint: `${ISSUER}/userinfo`,
    introspectionEndpoint: `${ISSUER}/introspect`,
    revocationEndpoint: null,
    endSessionEndpoint: null,
  }),

  authorize: async () => new URL(`${ISSUER}/authorize`),

  exchange: async (): Promise<PylonAuthTokenResult> => {
    throw new Error("not used");
  },

  refresh: async (): Promise<PylonAuthTokenResult> =>
    ({
      accessToken: REFRESHED_ACCESS_TOKEN,
      expiresIn: 7200,
      refreshToken: REFRESHED_REFRESH_TOKEN,
      tokenType: "Bearer",
    }) as PylonAuthTokenResult,

  introspect: async (_, { token }): Promise<PylonIntrospection> => {
    calls.introspect.push(token);

    return {
      active: true,
      audience: [ISSUER],
      custom: {},
      issuer: ISSUER,
      subject: "alice",
      tokenType: "Bearer",
    };
  },

  userinfo: async (_, { accessToken }): Promise<PylonUserinfo> => {
    calls.userinfo.push(accessToken);

    return { subject: "alice" };
  },
});

/**
 * Establishes a session the way a login callback would, minus the IdP round
 * trip. `issuedAt` is an hour old against a ten-minute deadline, so the
 * `half_life` midpoint is comfortably in the past and every request refreshes.
 */
const createSeedRouter = (): PylonRouter<any> => {
  const router = new PylonRouter<any>();

  router.post("/seed", async (ctx) => {
    const id = randomUUID();

    await ctx.session.set({
      id,
      accessToken: SEEDED_ACCESS_TOKEN,
      expiresAt: new Date(Date.now() + 600_000),
      idToken: SEEDED_ID_TOKEN,
      issuedAt: new Date(Date.now() - 3_600_000),
      refreshToken: SEEDED_REFRESH_TOKEN,
      scope: [],
      subject: "alice",
    });

    ctx.body = { id };
    ctx.status = 200;
  });

  return router;
};

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("session store sealing must not corrupt the live session", () => {
  let pylon: Pylon;
  let logger: ILogger;
  let amphora: IAmphora;
  let kek: IKryptos;
  let kv: ProteusSource;
  let calls: DriverCalls;

  beforeAll(async () => {
    logger = createMockLogger();

    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    const sig: IKryptos = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      curve: "P-256",
      publish: true,
      purpose: "token",
    });

    // The session store's KEK — INTERNAL and UNPUBLISHED, as a KEK always is.
    // This is the default recommended shape, and it is what makes the stored
    // tokens ciphertext at all.
    kek = KryptosKit.generate.enc.oct({
      algorithm: "A256GCMKW",
      publish: false,
      purpose: "pylon:kek",
    });

    amphora.add([sig, kek]);

    kv = new ProteusSource({
      driver: "sqlite",
      filename: ":memory:",
      entities: [] as never,
      logger,
      synchronize: true,
      amphora,
    });

    calls = { introspect: [], userinfo: [] };

    pylon = new Pylon({
      logger,
      amphora,
      domain: ISSUER,
      environment: "test",
      name: "@lindorm/pylon-auth-sealing-test",
      port: 0,
      version: "0.0.1",
      kv: kv as any,
      auth: {
        driver: createDriver(calls),
        // The DEFAULT mode for a driver that can refresh. The seeded session is
        // past its midpoint, so `/introspect` and `/userinfo` both refresh
        // opportunistically before their handler runs.
        refresh: { mode: "half_life" },
        router: { pathPrefix: "/auth" },
        session: {
          enabled: true,
          encryption: { condition: { purpose: "pylon:kek", publish: false } },
        },
      },
      routes: [{ path: "/test", router: createSeedRouter() }],
    });

    await pylon.setup();
  });

  afterAll(async () => {
    await pylon.stop().catch(() => undefined);
    await kv.disconnect().catch(() => undefined);
  });

  beforeEach(() => {
    calls.introspect = [];
    calls.userinfo = [];
  });

  const seed = async (): Promise<{ cookie: string; id: string }> => {
    const response = await loopback
      .request(pylon.callback)
      .post("/test/seed")
      .send({})
      .expect(200);

    const setCookie = response.get("Set-Cookie") as unknown as Array<string>;
    const pair = (setCookie ?? [])
      .map((header) => header.split(";")[0])
      .find((value) => value.startsWith("pylon_session="));

    if (!pair) throw new Error("pylon_session cookie not set on seed response");

    return { cookie: pair, id: response.body.id };
  };

  /** The row as it actually sits in the kv source, undecrypted. */
  const readRow = async (id: string): Promise<Session> => {
    const row = await kv.session({ logger }).repository(Session).findOne({ id });

    if (!row) throw new Error(`no stored session for id ${id}`);

    return row;
  };

  /**
   * The credential handed to the provider must be the token the refresh grant
   * just issued — never the at-rest ciphertext of it. `isAesString` is asserted
   * separately from the equality so a failure names WHICH of the two went wrong.
   */
  const assertPlaintext = (token: string | undefined): void => {
    expect(token).toBeDefined();
    expect(AesKit.isAesString(token!)).toBe(false);
    expect(token).toBe(REFRESHED_ACCESS_TOKEN);
  };

  test("sends the refreshed PLAINTEXT access token to the driver on /introspect", async () => {
    const seeded = await seed();

    await loopback
      .request(pylon.callback)
      .get("/auth/introspect")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(calls.introspect).toHaveLength(1);

    assertPlaintext(calls.introspect[0]);
  });

  test("sends the refreshed PLAINTEXT access token to the driver on /userinfo", async () => {
    const seeded = await seed();

    await loopback
      .request(pylon.callback)
      .get("/auth/userinfo")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(calls.userinfo).toHaveLength(1);

    assertPlaintext(calls.userinfo[0]);
  });

  /**
   * The other way to make plaintext reach the driver is to stop encrypting, so
   * the at-rest side is asserted in the same breath — against a REAL sqlite kv
   * source, i.e. the DDL and the round trip a deployment actually runs.
   *
   * The row's key is derived from the holder's `sec` and is NOT the deployment's
   * KEK: the KEK's only job now is sealing the cookie. So the assertion is the
   * strong one — the running pylon's own aegis, holding every key it has, cannot
   * open the row it just wrote.
   */
  test("stores no token material and nothing the server can open", async () => {
    const seeded = await seed();

    await loopback
      .request(pylon.callback)
      .get("/auth/introspect")
      .set("cookie", seeded.cookie)
      .expect(200);

    const row = await readRow(seeded.id);

    for (const token of [
      SEEDED_ACCESS_TOKEN,
      SEEDED_ID_TOKEN,
      SEEDED_REFRESH_TOKEN,
      REFRESHED_ACCESS_TOKEN,
      REFRESHED_REFRESH_TOKEN,
    ]) {
      expect(row.payloadEncrypted).not.toContain(token);
    }

    expect(AesKit.isAesString(row.payloadEncrypted)).toBe(true);
    expect(AesKit.parse(row.payloadEncrypted).keyId).not.toBe(kek.id);

    // The cleartext columns are the four pylon must read with no holder present.
    expect(row.subject).toBe("alice");
    expect(row.issuedAt).toBeInstanceOf(Date);
    expect(row.expiresAt).toBeInstanceOf(Date);
    expect(row).not.toHaveProperty("accessToken");
    expect(row).not.toHaveProperty("scope");

    // Every key this deployment holds, and none of them opens it.
    await expect(
      new Aegis({ amphora, logger }).aes.decrypt(row.payloadEncrypted),
    ).rejects.toThrow();
  });

  // The row survives the round trip on a REAL driver: the request that follows
  // reads it back and the session is live, so the `text` column and the
  // timestamps really did persist and re-hydrate.
  test("reads the sealed row back through a real sqlite kv source", async () => {
    const seeded = await seed();

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/introspect")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.body.subject).toBe("alice");
    expect(await readRow(seeded.id)).toBeDefined();
  });
});
