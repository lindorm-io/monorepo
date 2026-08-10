import type { IAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import {
  ACCESS_MOUNT,
  OPAQUE_TOKEN,
  introspectionAnswer,
} from "../../__fixtures__/access/tokens.js";
import { useAccessToken } from "./use-access-token.js";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import type { PylonIntrospectionActive } from "../../types/index.js";

/** Auth configured with a driver that CAN introspect — the ordinary resource
 *  server, so the opaque arm is reachable. */
const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

const METHOD = "POST";
const ORIGIN = "https://api.example.com";
const PATH = "/orders";
const HTU = `${ORIGIN}${PATH}`;

/**
 * RFC 9449 §6.2 standardises DPoP-bound OPAQUE tokens: `cnf.jkt` arrives as a
 * top-level member of the introspection response, and the resource server
 * "uses the data of the introspection response to validate the access token
 * binding itself locally". The binding check therefore has to run on BOTH
 * credential paths — these tests prove it does, and that it can FAIL on the
 * introspected one rather than being silently skipped.
 */
describe("useAccessToken — DPoP binding", () => {
  let aegis: IAegis;
  let client: DpopTestClient;
  let boundToken: string;
  let unboundToken: string;
  let ctx: any;
  let next: any;

  const makeCtx = (authorization: any, dpopHeader?: string): any => ({
    aegis,
    auth: { introspect: vi.fn() },
    logger: createMockLogger(),
    method: METHOD,
    origin: ORIGIN,
    path: PATH,
    request: {},
    get: vi.fn((header: string) =>
      header.toLowerCase() === "dpop" ? dpopHeader : undefined,
    ),
    state: {
      access: null,
      app: { config: APP_CONFIG },
      authorization,
      session: null,
      tokens: {},
    },
  });

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());
    client = await createDpopTestClient();

    // ⚠ Minted under the `access_token` PROFILE — the only thing `useAccessToken`
    // verifies. A `mint("default", …)` token carries the wrong `typ` and none of
    // the RFC 9068 required claims, so it no longer verifies at all and would
    // fail every case here for a reason that is not the binding.
    boundToken = await mintTestAccessToken(aegis, {
      confirmation: { thumbprint: client.jkt },
    });
    unboundToken = await mintTestAccessToken(aegis);
  });

  beforeEach(() => {
    next = vi.fn();
  });

  afterEach(() => {
    MockDate.reset();
  });

  describe("verified provenance", () => {
    test("accepts a matching proof", async () => {
      const proof = await client.sign({
        method: METHOD,
        uri: HTU,
        accessToken: boundToken,
      });
      ctx = makeCtx({ type: "dpop", value: boundToken }, proof);

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("rejects a proof whose htm does not match the request", async () => {
      const proof = await client.sign({
        method: "GET",
        uri: HTU,
        accessToken: boundToken,
      });
      ctx = makeCtx({ type: "dpop", value: boundToken }, proof);

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects a bound token presented as bearer with no proof", async () => {
      ctx = makeCtx({ type: "bearer", value: boundToken });

      try {
        await useAccessToken(ACCESS_MOUNT)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("missing_dpop_proof");
      }
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects an unbound token presented under the DPoP scheme", async () => {
      const proof = await client.sign({
        method: METHOD,
        uri: HTU,
        accessToken: unboundToken,
      });
      ctx = makeCtx({ type: "dpop", value: unboundToken }, proof);

      try {
        await useAccessToken(ACCESS_MOUNT)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("token_not_dpop_bound");
      }
    });

    test("accepts an unbound token presented as bearer", async () => {
      ctx = makeCtx({ type: "bearer", value: unboundToken });

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("introspected provenance", () => {
    /**
     * The answer restates `issuer` because this deployment pins the real-Aegis
     * one, and it carries `tokenType` because RFC 7662 §2.2's `token_type` is now
     * asserted PRESENT — a bare `{ active: true }` is refused before any binding
     * check is reached.
     */
    const active = (thumbprint?: string): PylonIntrospectionActive =>
      introspectionAnswer({
        issuer: ACCESS_TEST_ISSUER,
        ...(thumbprint ? { confirmation: { thumbprint } } : {}),
      });

    test("accepts a matching proof against cnf.jkt from the introspection response", async () => {
      const proof = await client.sign({
        method: METHOD,
        uri: HTU,
        accessToken: OPAQUE_TOKEN,
      });
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN }, proof);
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("REJECTS a proof whose htu does not match the request", async () => {
      const proof = await client.sign({
        method: METHOD,
        uri: `${ORIGIN}/other-path`,
        accessToken: OPAQUE_TOKEN,
      });
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN }, proof);
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      try {
        await useAccessToken(ACCESS_MOUNT)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
      expect(next).not.toHaveBeenCalled();
    });

    test("REJECTS a proof bound to a different key", async () => {
      const other = await createDpopTestClient();
      const proof = await other.sign({
        method: METHOD,
        uri: HTU,
        accessToken: OPAQUE_TOKEN,
      });
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN }, proof);
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });

    test("REJECTS a proof whose ath hashes a different access token (RFC 9449 §7)", async () => {
      const proof = await client.sign({
        method: METHOD,
        uri: HTU,
        accessToken: "some-other-opaque-token",
      });
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN }, proof);
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });

    test("REJECTS a stale proof once its iat falls outside the skew window", async () => {
      const proof = await client.sign({
        method: METHOD,
        uri: HTU,
        accessToken: OPAQUE_TOKEN,
      });
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN }, proof);
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      MockDate.set(new Date(Date.now() + 10 * 60 * 1000));

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects a bound opaque token presented as bearer with no proof", async () => {
      ctx = makeCtx({ type: "bearer", value: OPAQUE_TOKEN });
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      try {
        await useAccessToken(ACCESS_MOUNT)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("missing_dpop_proof");
      }
    });

    test("accepts an unbound opaque token presented as bearer", async () => {
      ctx = makeCtx({ type: "bearer", value: OPAQUE_TOKEN });
      ctx.auth.introspect.mockResolvedValue(active());

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("rejects the DPoP scheme with no DPoP header before introspecting", async () => {
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN });

      try {
        await useAccessToken(ACCESS_MOUNT)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("missing_dpop_header");
      }
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
    });
  });
});
