// `POST /:prefix/refresh` through the REAL auth router — real refresh
// middleware, real driver, real session store, real cookie.
//
// The route used to answer 204 with an empty body whether the session was
// refreshed or skipped entirely, so a caller could not tell "you have a fresh
// lifetime" from "nothing happened, the old expiry stands" — which is the one
// question the endpoint exists to answer. Only an end-to-end run proves the
// reporting, because what is being asserted is the seam: the MIDDLEWARE records
// what it did on `ctx.state`, the ROUTE reads it back.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import type { IPylonAuthDriver } from "../interfaces/index.js";
import type { PylonAuthTokenResult, PylonEncKey } from "../types/index.js";
import { Pylon } from "./Pylon.js";
import { PylonRouter } from "./PylonRouter.js";

const ISSUER = "http://auth-refresh.test.lindorm.io";

const SESSION_KEY: PylonEncKey = {
  condition: { purpose: "pylon:kek", publish: false },
};

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
    const signed = await ctx.aegis.mint("default", {
      audience: [ISSUER],
      expires: `${SEEDED_EXPIRES_IN} seconds`,
      subject: "alice",
      tokenType: "access_token",
    });

    await ctx.session.set({
      id: randomUUID(),
      accessToken: signed.token,
      expiresAt: signed.expiresAt,
      issuedAt: new Date(),
      scope: [],
      subject: "alice",
      ...(ctx.data?.withRefreshToken === false ? {} : { refreshToken: "refresh-token" }),
    });

    ctx.body = { expiresAt: signed.expiresAt };
    ctx.status = 200;
  });

  return router;
};

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("POST /auth/refresh", () => {
  let pylon: Pylon;
  let logger: ILogger;
  let amphora: IAmphora;
  let kv: ProteusSource;

  beforeAll(async () => {
    logger = createMockLogger();

    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    const kek: IKryptos = KryptosKit.generate.enc.oct({
      algorithm: "A128KW",
      publish: false,
      purpose: "pylon:kek",
    });
    const sig: IKryptos = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      curve: "P-256",
      publish: true,
      purpose: "token",
    });

    amphora.add([kek, sig]);

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
        router: { pathPrefix: "/auth" },
        session: { enabled: true, encryption: SESSION_KEY },
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

  test("should report refreshed: true and the NEW expiry", async () => {
    const seeded = await seed(true);

    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.body.refreshed).toBe(true);

    // The new lifetime, not the configured one the caller may not hold — and
    // demonstrably not the one it went in with.
    expect(response.body.expires_at).not.toBe(seeded.expiresAt);

    const seconds = (new Date(response.body.expires_at).getTime() - Date.now()) / 1000;

    expect(seconds).toBeGreaterThan(SEEDED_EXPIRES_IN);
    expect(seconds).toBeLessThanOrEqual(REFRESHED_EXPIRES_IN);
  });

  // A session established without `offline_access` holds no refresh token, so
  // there is nothing to exchange. The middleware SKIPS it and leaves it intact —
  // the caller must learn that the old expiry still stands.
  test("should report refreshed: false and the ORIGINAL expiry when there is no refresh token", async () => {
    const seeded = await seed(false);

    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.body.refreshed).toBe(false);
    expect(response.body.expires_at).toBe(seeded.expiresAt);
  });

  test("should answer 401 when no session is presented", async () => {
    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .expect(401);

    expect(response.body.error.code).toBe("refresh_session_required");
  });
});
