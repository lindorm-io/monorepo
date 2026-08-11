// What `ctx.state.tokens` holds AFTER a grant replaced the session, through the
// REAL auth router.
//
// The session middleware parses `session.accessToken` / `session.idToken` into
// `ctx.state.tokens` at the top of the request. The refresh middleware then
// replaces `ctx.state.session` wholesale — but left those parsed buckets alone,
// so they went on describing the token that had just been thrown away.
//
// That is not a cosmetic staleness: `ctx.auth.introspect()` and `.userinfo()`
// answer FROM those buckets whenever they hold a JWT, without consulting the
// session at all. So `/introspect` reported the replaced token's claims —
// its scope, and its `exp` — as the description of a session that no longer
// carries it.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import type { IPylonAuthDriver } from "../interfaces/index.js";
import type { PylonAuthTokenResult } from "../types/index.js";
import { Pylon } from "./Pylon.js";
import { PylonRouter } from "./PylonRouter.js";

const ISSUER = "http://auth-stale-tokens.test.lindorm.io";

const SEEDED_EXPIRES_IN = 3600;
const REFRESHED_EXPIRES_IN = 7200;

const SEEDED_SCOPE = ["openid"];
const REFRESHED_SCOPE = ["openid", "orders:write"];

const SEEDED_NAME = "Alice Seeded";
const REFRESHED_NAME = "Alice Refreshed";

/**
 * The grant mints REAL tokens off the vault, carrying claims that differ from
 * the seeded ones in a way each route surfaces: `/introspect` reports the access
 * token's scope and expiry, `/userinfo` reports the id token's profile.
 *
 * Neither `introspect` nor `userinfo` is implemented, on purpose — both routes
 * must answer from the locally parsed tokens, and a fast path that failed to
 * fire raises `driver_cannot_*` rather than quietly asking a stub.
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

  refresh: async (context): Promise<PylonAuthTokenResult> => {
    const access = await context.aegis.mint("default", {
      audience: [ISSUER],
      expires: `${REFRESHED_EXPIRES_IN} seconds`,
      scope: REFRESHED_SCOPE,
      subject: "alice",
      tokenType: "access_token",
    });

    const id = await context.aegis.mint("default", {
      audience: ["client-id"],
      expires: `${REFRESHED_EXPIRES_IN} seconds`,
      profile: { name: REFRESHED_NAME },
      subject: "alice",
      tokenType: "id_token",
    });

    return {
      accessToken: access.token,
      expiresIn: REFRESHED_EXPIRES_IN,
      idToken: id.token,
      refreshToken: "refresh-token-rotated",
      tokenType: "Bearer",
    } as PylonAuthTokenResult;
  },
});

const createSeedRouter = (): PylonRouter<any> => {
  const router = new PylonRouter<any>();

  router.post("/seed", async (ctx) => {
    const access = await ctx.aegis.mint("default", {
      audience: [ISSUER],
      expires: `${SEEDED_EXPIRES_IN} seconds`,
      scope: SEEDED_SCOPE,
      subject: "alice",
      tokenType: "access_token",
    });

    const id = await ctx.aegis.mint("default", {
      audience: ["client-id"],
      expires: `${SEEDED_EXPIRES_IN} seconds`,
      profile: { name: SEEDED_NAME },
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

  return router;
};

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("parsed tokens after a refresh", () => {
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
      name: "@lindorm/pylon-auth-stale-tokens-test",
      port: 0,
      version: "0.0.1",
      kv: kv as any,
      auth: {
        driver: createDriver(),
        // Every request through `/introspect` and `/userinfo` refreshes, which
        // is the case the parsed buckets go stale in.
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
      .send({})
      .expect(200);

    const setCookie = response.get("Set-Cookie") as unknown as Array<string>;
    const pair = (setCookie ?? [])
      .map((header) => header.split(";")[0])
      .find((value) => value.startsWith("pylon_session="));

    if (!pair) throw new Error("pylon_session cookie not set on seed response");

    return { cookie: pair, expiresAt: response.body.expires_at };
  };

  test("/introspect describes the REFRESHED access token, not the replaced one", async () => {
    const seeded = await seed();

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/introspect")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.get("x-pylon-session-refreshed")).toBe("true");

    expect(response.body.active).toBe(true);
    expect(response.body.scope).toEqual(REFRESHED_SCOPE);

    // The claim that matters operationally: an introspection answer stating an
    // `exp` the session no longer has. The replaced token's is an hour out, the
    // new one's two.
    expect(response.body.expires_at).not.toBe(seeded.expiresAt);

    const seconds = (new Date(response.body.expires_at).getTime() - Date.now()) / 1000;

    expect(seconds).toBeGreaterThan(SEEDED_EXPIRES_IN);
    expect(seconds).toBeLessThanOrEqual(REFRESHED_EXPIRES_IN);
  });

  test("/userinfo describes the REFRESHED id token, not the replaced one", async () => {
    const seeded = await seed();

    const response = await loopback
      .request(pylon.callback)
      .get("/auth/userinfo")
      .set("cookie", seeded.cookie)
      .expect(200);

    expect(response.get("x-pylon-session-refreshed")).toBe("true");

    expect(response.body.subject).toBe("alice");
    expect(response.body.name).toBe(REFRESHED_NAME);
  });
});
