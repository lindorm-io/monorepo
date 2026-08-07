import type { IAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { ACCESS_TEST_ISSUER, createTestAegis } from "../../__fixtures__/access/aegis.js";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import { OPAQUE_TOKEN } from "../../__fixtures__/access/tokens.js";
import { createAccessTokenMiddleware } from "./create-access-token-middleware.js";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";

/** Auth configured with a driver that CAN introspect — the ordinary resource
 *  server, so the opaque arm is reachable. */
const APP_CONFIG = createTestAppConfig({ auth: createTestAuthConfig() });

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
describe("createAccessTokenMiddleware — DPoP binding", () => {
  const options: any = { issuer: ACCESS_TEST_ISSUER };

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

    const bound = await aegis.mint("default", {
      audience: [ACCESS_TEST_ISSUER],
      confirmation: { thumbprint: client.jkt },
      expires: "1 hour",
      subject: "alice",
      tokenType: "access_token",
    });
    boundToken = bound.token;

    const unbound = await aegis.mint("default", {
      audience: [ACCESS_TEST_ISSUER],
      expires: "1 hour",
      subject: "alice",
      tokenType: "access_token",
    });
    unboundToken = unbound.token;
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

      await expect(
        createAccessTokenMiddleware(options)(ctx, next),
      ).resolves.toBeUndefined();

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

      await expect(createAccessTokenMiddleware(options)(ctx, next)).rejects.toThrow(
        ClientError,
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects a bound token presented as bearer with no proof", async () => {
      ctx = makeCtx({ type: "bearer", value: boundToken });

      try {
        await createAccessTokenMiddleware(options)(ctx, next);
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
        await createAccessTokenMiddleware(options)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("token_not_dpop_bound");
      }
    });

    test("accepts an unbound token presented as bearer", async () => {
      ctx = makeCtx({ type: "bearer", value: unboundToken });

      await expect(
        createAccessTokenMiddleware(options)(ctx, next),
      ).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("introspected provenance", () => {
    const active = (thumbprint?: string) => ({
      active: true,
      subject: "alice",
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

      await expect(
        createAccessTokenMiddleware(options)(ctx, next),
      ).resolves.toBeUndefined();

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
        await createAccessTokenMiddleware(options)(ctx, next);
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

      await expect(createAccessTokenMiddleware(options)(ctx, next)).rejects.toThrow(
        ClientError,
      );
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

      await expect(createAccessTokenMiddleware(options)(ctx, next)).rejects.toThrow(
        ClientError,
      );
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

      await expect(createAccessTokenMiddleware(options)(ctx, next)).rejects.toThrow(
        ClientError,
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects a bound opaque token presented as bearer with no proof", async () => {
      ctx = makeCtx({ type: "bearer", value: OPAQUE_TOKEN });
      ctx.auth.introspect.mockResolvedValue(active(client.jkt));

      try {
        await createAccessTokenMiddleware(options)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("missing_dpop_proof");
      }
    });

    test("accepts an unbound opaque token presented as bearer", async () => {
      ctx = makeCtx({ type: "bearer", value: OPAQUE_TOKEN });
      ctx.auth.introspect.mockResolvedValue(active());

      await expect(
        createAccessTokenMiddleware(options)(ctx, next),
      ).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("rejects the DPoP scheme with no DPoP header before introspecting", async () => {
      ctx = makeCtx({ type: "dpop", value: OPAQUE_TOKEN });

      try {
        await createAccessTokenMiddleware(options)(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("missing_dpop_header");
      }
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
    });
  });
});
