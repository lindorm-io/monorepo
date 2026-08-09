// A grant that FAILS, through the REAL auth router — real refresh middleware,
// real driver, real session store, real cookie.
//
// The middleware used to delete the session on any failed exchange, whichever
// route it was mounted on. A failed exchange is ambiguous — a spent refresh
// token and an IdP that was unreachable for two seconds look identical from
// there — so a transient network fault on a `GET /introspect` logged the user
// out. Only the MOUNT knows which reading is the safe one.
//
// End-to-end because what is being asserted is the seam: the ROUTER declares
// the reading per mount, the MIDDLEWARE acts on it, and the STORE is what
// survives or does not.

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

const ISSUER = "http://auth-refresh-failure.test.lindorm.io";

/** The lifetime the seeded session starts with. */
const SEEDED_EXPIRES_IN = 3600;

/**
 * A driver whose refresh grant always rejects — the IdP that is down, or the
 * refresh token that is spent. Which of the two it is cannot be told from here,
 * which is the whole point.
 */
const createDriver = (): IPylonAuthDriver => ({
  clientId: "client-id",
  issuerScope: "none",

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

  refresh: async (): Promise<PylonAuthTokenResult> => {
    throw new Error("connect ECONNREFUSED — the token endpoint is unreachable");
  },
});

/**
 * `/seed` establishes a session the way a login callback would; `/probe` reads
 * back what is actually IN the store, which is what a later request would find.
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

    // An id token too, so `/userinfo`'s local fast path can answer without the
    // driver — this driver has no `userinfo`, and what is under test is the
    // refresh middleware in front of the handler, not the handler.
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
      refreshToken: "refresh-token",
      scope: [],
      subject: "alice",
    });

    ctx.body = { expiresAt: access.expiresAt };
    ctx.status = 200;
  });

  router.get("/probe", async (ctx) => {
    const session = await ctx.session.get();

    ctx.body = { alive: Boolean(session), expiresAt: session?.expiresAt ?? null };
    ctx.status = 200;
  });

  return router;
};

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("a refresh grant that fails", () => {
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
      name: "@lindorm/pylon-auth-refresh-failure-test",
      port: 0,
      version: "0.0.1",
      kv: kv as any,
      auth: {
        driver: createDriver(),
        // `force` so every request through a refresh middleware attempts the
        // grant — a legitimate configured mode on `/introspect` and
        // `/userinfo`, which is exactly why the mode cannot be what decides
        // whether a failure is fatal.
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

  const seed = async (): Promise<{ cookie: string; expiresAt: string }> => {
    const response = await loopback
      .request(pylon.callback)
      .post("/test/seed")
      .expect(200);

    const setCookie = response.get("Set-Cookie") as unknown as Array<string>;
    const pair = (setCookie ?? [])
      .map((header) => header.split(";")[0])
      .find((value) => value.startsWith("pylon_session="));

    if (!pair) throw new Error("pylon_session cookie not set on seed response");

    return { cookie: pair, expiresAt: response.body.expires_at };
  };

  const probe = async (
    cookie: string,
  ): Promise<{ alive: boolean; expiresAt: string | null }> => {
    const response = await loopback
      .request(pylon.callback)
      .get("/test/probe")
      .set("cookie", cookie)
      .expect(200);

    return { alive: response.body.alive, expiresAt: response.body.expires_at };
  };

  // The caller asked for a working session and cannot be given one. Answering
  // `204` would report success for a request that logged the user out.
  test("should destroy the session on the explicit refresh route", async () => {
    const seeded = await seed();

    const response = await loopback
      .request(pylon.callback)
      .post("/auth/refresh")
      .set("cookie", seeded.cookie)
      .expect(401);

    expect(response.body.error.code).toBe("refresh_session_required");

    expect(await probe(seeded.cookie)).toEqual({ alive: false, expiresAt: null });
  });

  // Nobody asked for a refresh here. `/introspect` was asked whether the token
  // is valid, and it still is — a blip at the IdP is not an answer to that
  // question, and must not cost the user their session.
  test("should leave the session intact behind an opportunistic /introspect", async () => {
    const seeded = await seed();

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/introspect")
      .set("cookie", seeded.cookie)
      .expect(200);

    // The refresh did not happen, and the original deadline still stands — the
    // caller learns both from headers, on a route that answers with its own
    // payload and has no body to spare.
    expect(response.get("x-pylon-session-refreshed")).toBe("false");
    expect(response.get("x-pylon-session-expires-at")).toBe(seeded.expiresAt);

    // Alive AND on its original terms: not merely undeleted, but carrying the
    // deadline it came in with. A failed grant must not move the expiry either.
    expect(await probe(seeded.cookie)).toEqual({
      alive: true,
      expiresAt: seeded.expiresAt,
    });
  });

  test("should leave the session intact behind an opportunistic /userinfo", async () => {
    const seeded = await seed();

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/userinfo")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.get("x-pylon-session-refreshed")).toBe("false");
    expect(response.get("x-pylon-session-expires-at")).toBe(seeded.expiresAt);

    expect(await probe(seeded.cookie)).toEqual({
      alive: true,
      expiresAt: seeded.expiresAt,
    });
  });
});
