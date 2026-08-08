// The refresh OUTCOME through the REAL auth router — real refresh middleware,
// real driver, real session store, real cookie.
//
// The route used to answer 204 with an empty body whether the session was
// refreshed or skipped entirely, so a caller could not tell "you have a fresh
// lifetime" from "nothing happened, the old expiry stands" — which is the one
// question it exists to answer. It then answered with a body, which was worse
// in a different way: the same middleware runs on `/introspect` and
// `/userinfo`, so the fact is produced on every one of those routes, and a body
// field could only ever be read on one of them.
//
// It is reported on RESPONSE HEADERS, which is what this suite proves — not by
// asserting the claim on `/refresh` and taking the others on trust, but by
// running all three.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import type { IPylonAuthDriver } from "../interfaces/index.js";
import type { PylonAuthTokenResult } from "../types/index.js";
import { Pylon } from "./Pylon.js";
import { PylonRouter } from "./PylonRouter.js";

const ISSUER = "http://auth-refresh.test.lindorm.io";

/** The lifetime the seeded session starts with. */
const SEEDED_EXPIRES_IN = 3600;

/** The lifetime the driver's refresh grant hands back — deliberately different. */
const REFRESHED_EXPIRES_IN = 7200;

/**
 * A driver that can serve the router (`authorize` + `exchange` are what
 * `validateAuthSettings` requires for a mounted `/login`) and can refresh. The
 * refresh mints a REAL access token off the vault, so `parseTokenData` reads a
 * real `exp` rather than falling through to the envelope.
 */
const createDriver = (): IPylonAuthDriver => ({
  clientId: "client-id",

  endpoints: () => ({
    issuer: ISSUER,
    authorizationEndpoint: `${ISSUER}/authorize`,
    tokenEndpoint: `${ISSUER}/token`,
    userinfoEndpoint: null,
    introspectionEndpoint: null,
    revocationEndpoint: null,
    endSessionEndpoint: null,
  }),

  authorize: async () => new URL(`${ISSUER}/authorize`),

  exchange: async (): Promise<PylonAuthTokenResult> => {
    throw new Error("not used");
  },

  refresh: async (context): Promise<PylonAuthTokenResult> => {
    const signed = await context.aegis.mint("default", {
      audience: [ISSUER],
      expires: `${REFRESHED_EXPIRES_IN} seconds`,
      subject: "alice",
      tokenType: "access_token",
    });

    return {
      accessToken: signed.token,
      expiresIn: REFRESHED_EXPIRES_IN,
      refreshToken: "refresh-token-rotated",
      tokenType: "Bearer",
    } as PylonAuthTokenResult;
  },
});

/**
 * Establishes a session the way a login callback would, minus the IdP round
 * trip. `withRefreshToken: false` is the `offline_access`-less session — alive,
 * renewable by nobody.
 */
const createSeedRouter = (): PylonRouter<any> => {
  const router = new PylonRouter<any>();

  router.post("/seed", async (ctx) => {
    const access = await ctx.aegis.mint("default", {
      audience: [ISSUER],
      expires: `${SEEDED_EXPIRES_IN} seconds`,
      subject: "alice",
      tokenType: "access_token",
    });

    // An id token as well, so `/userinfo`'s local fast path can answer without
    // a driver `userinfo` method — this suite is about the middleware in front
    // of the handlers, not the handlers.
    const id = await ctx.aegis.mint("default", {
      audience: ["client-id"],
      expires: `${SEEDED_EXPIRES_IN} seconds`,
      subject: "alice",
      tokenType: "id_token",
    });

    await ctx.session.set({
      id: randomUUID(),
      accessToken: access.token,
      expiresAt: access.expiresAt,
      idToken: id.token,
      issuedAt: new Date(),
      scope: [],
      subject: "alice",
      ...(ctx.data?.withRefreshToken === false ? {} : { refreshToken: "refresh-token" }),
    });

    ctx.body = { expiresAt: access.expiresAt };
    ctx.status = 200;
  });

  return router;
};

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("refresh outcome headers", () => {
  let pylon: Pylon;
  let logger: ILogger;
  let amphora: IAmphora;
  let kv: ProteusSource;

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
    // The suite runs with session encryption ON because that is the recommended
    // production shape, and because a middleware chain that reads the stored
    // tokens back is the only thing that proves they come back as tokens.
    const kek: IKryptos = KryptosKit.generate.enc.oct({
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

    pylon = new Pylon({
      logger,
      amphora,
      domain: ISSUER,
      environment: "test",
      name: "@lindorm/pylon-auth-refresh-test",
      port: 0,
      version: "0.0.1",
      kv: kv as any,
      auth: {
        driver: createDriver(),
        // `force` on every mount: `/introspect` and `/userinfo` refresh
        // opportunistically under it, which is the case the headers exist for.
        refresh: { mode: "force" },
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

  const seed = async (
    withRefreshToken: boolean,
  ): Promise<{ cookie: string; expiresAt: string }> => {
    const response = await loopback
      .request(pylon.callback)
      .post("/test/seed")
      .send({ withRefreshToken })
      .expect(200);

    const setCookie = response.get("Set-Cookie") as unknown as Array<string>;
    const pair = (setCookie ?? [])
      .map((header) => header.split(";")[0])
      .find((value) => value.startsWith("pylon_session="));

    if (!pair) throw new Error("pylon_session cookie not set on seed response");

    return { cookie: pair, expiresAt: response.body.expires_at };
  };

  const assertRefreshed = (expiresAt: string | undefined, was: string): void => {
    // The new lifetime, not the configured one the caller may not hold — and
    // demonstrably not the one the session went in with.
    expect(expiresAt).toBeDefined();
    expect(expiresAt).not.toBe(was);

    const seconds = (new Date(expiresAt!).getTime() - Date.now()) / 1000;

    expect(seconds).toBeGreaterThan(SEEDED_EXPIRES_IN);
    expect(seconds).toBeLessThanOrEqual(REFRESHED_EXPIRES_IN);
  };

  test("should answer 204 with no body on the refresh route", async () => {
    const seeded = await seed(true);

    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .set("cookie", seeded.cookie)
      .expect(204);

    expect(response.text).toBe("");
    expect(response.get("x-pylon-session-refreshed")).toBe("true");

    assertRefreshed(response.get("x-pylon-session-expires-at"), seeded.expiresAt);
  });

  // The claim is that the outcome is readable wherever the middleware ran. Run
  // it on the two routes it rides along on, rather than asserting it once and
  // trusting the wiring.
  test("should report an opportunistic refresh on /introspect", async () => {
    const seeded = await seed(true);

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/introspect")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.get("x-pylon-session-refreshed")).toBe("true");

    assertRefreshed(response.get("x-pylon-session-expires-at"), seeded.expiresAt);
  });

  test("should report an opportunistic refresh on /userinfo", async () => {
    const seeded = await seed(true);

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/userinfo")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.get("x-pylon-session-refreshed")).toBe("true");

    assertRefreshed(response.get("x-pylon-session-expires-at"), seeded.expiresAt);
  });

  // A session established without `offline_access` holds no refresh token, so
  // there is nothing to exchange. The middleware SKIPS it and leaves it intact —
  // the caller must learn that the old expiry still stands.
  test("should report false and the ORIGINAL expiry when there is no refresh token", async () => {
    const seeded = await seed(false);

    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .set("cookie", seeded.cookie)
      .expect(204);

    expect(response.get("x-pylon-session-refreshed")).toBe("false");
    expect(response.get("x-pylon-session-expires-at")).toBe(seeded.expiresAt);
  });

  test("should answer 401 when no session is presented", async () => {
    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .expect(401);

    expect(response.body.error.code).toBe("refresh_session_required");

    // The middleware threw before it could do anything, so there is no outcome
    // to report — and a header that is set unconditionally when it RAN is what
    // makes that absence readable.
    expect(response.get("x-pylon-session-refreshed")).toBeUndefined();
  });
});
