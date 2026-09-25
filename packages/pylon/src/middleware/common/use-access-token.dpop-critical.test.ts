import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, describe, expect, test, vi } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import { ACCESS_MOUNT } from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { useAccessToken } from "./use-access-token.js";

const METHOD = "POST";
const ORIGIN = "https://api.example.com";
const PATH = "/orders";
const HTU = `${ORIGIN}${PATH}`;
const HANDSHAKE_HOST = "api.example.com";
const HANDSHAKE_HTU = `https://${HANDSHAKE_HOST}/socket.io/`;

const appConfig = (critical?: Array<string>) =>
  createTestAppConfig({
    auth: createTestAuthConfig({
      issuer: ACCESS_TEST_ISSUER,
      ...(critical && { critical }),
    }),
  });

/**
 * The deployment's `critical` declaration at the RFC 9449 proof door, measured at
 * the public door with a REAL aegis over real keys — a mock cannot refuse a
 * `crit`, so only a real key proves the declaration travelled all the way down.
 * `Aegis.verifyDpopProof` is a static, so it is real here whatever the instance is.
 *
 * Each of the two transports is its own threading site, so each takes its own
 * pin: a one-line revert at either leaves the other arm green.
 *
 * ⚠ The declaration is DOMAIN-named (`["objectId"]`) and the proof header carries
 * the WIRE spelling (`crit: ["oid"]`); aegis crosses between them.
 *
 * ⚠ A deployment with NO auth block cannot reach this door at all — the issuer is
 * resolved first and `resolveAccessIssuer` refuses — so "declares nothing" is
 * measured here as `critical: []` and at the unit door as `undefined`
 * (`internal/utils/dpop/assert-dpop-binding.test.ts`).
 */
describe("useAccessToken — DPoP proof crit declaration", () => {
  let aegis: IAegis;
  let client: DpopTestClient;
  let boundToken: string;

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());
    client = await createDpopTestClient();
    boundToken = await mintTestAccessToken(aegis, {
      confirmation: { thumbprint: client.jkt },
    });
  });

  const critProof = (uri: string, method: string): Promise<string> =>
    client.sign({
      method,
      uri,
      accessToken: boundToken,
      header: { crit: ["oid"], oid: "1.2.3.4" },
    });

  describe("HTTP access-token path", () => {
    const makeCtx = (critical: Array<string> | undefined, proof: string): any => ({
      aegis,
      auth: { introspect: vi.fn() },
      logger: createMockLogger(),
      method: METHOD,
      origin: ORIGIN,
      path: PATH,
      request: {},
      get: vi.fn((header: string) =>
        header.toLowerCase() === "dpop" ? proof : undefined,
      ),
      state: {
        access: null,
        app: { config: appConfig(critical) },
        authorization: { type: "dpop", value: boundToken },
        session: null,
        tokens: {},
      },
    });

    test("a proof whose crit names a declared parameter verifies", async () => {
      const ctx = makeCtx(["objectId"], await critProof(HTU, METHOD));
      const next = vi.fn();

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // The wrapper keeps its OWN `code` (`@lindorm/errors` LindormError), so
    // aegis's `dpop_unsupported_crit_param` is identified by what it folds in:
    // the refused WIRE parameter in `data` and its message in `errors`.
    test("the same proof is refused when the deployment declares nothing", async () => {
      const ctx = makeCtx(undefined, await critProof(HTU, METHOD));
      const next = vi.fn();

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "invalid_dpop_proof",
        data: { param: "oid" },
        errors: [expect.stringContaining("Unsupported critical header parameter")],
      });

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("socket handshake path", () => {
    const makeCtx = (critical: Array<string> | undefined, proof: string): any => ({
      aegis,
      auth: { introspect: vi.fn() },
      logger: createMockLogger(),
      handshakeId: "hsk-1",
      state: { access: null, app: { config: appConfig(critical) }, tokens: {} },
      io: {
        socket: {
          handshake: {
            auth: { bearer: boundToken },
            headers: { host: HANDSHAKE_HOST, dpop: proof },
            secure: true,
            url: "/socket.io/?EIO=4&transport=websocket",
          },
          data: { app: {}, tokens: {}, pylon: {} },
        },
      },
    });

    test("a proof whose crit names a declared parameter verifies", async () => {
      const ctx = makeCtx(["objectId"], await critProof(HANDSHAKE_HTU, "GET"));
      const next = vi.fn();

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.io.socket.data.pylon.access.provenance).toBe("verified");
      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("the same proof is refused when the deployment declares nothing", async () => {
      const ctx = makeCtx(undefined, await critProof(HANDSHAKE_HTU, "GET"));
      const next = vi.fn();

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "invalid_dpop_proof",
        data: { param: "oid" },
        errors: [expect.stringContaining("Unsupported critical header parameter")],
      });

      expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
