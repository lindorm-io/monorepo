import { Aegis } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { PylonAuthDriverContext } from "../../../../types/index.js";
import { resolveClientAuthentication } from "./resolve-client-authentication.js";

const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const SECRET = "a-client-secret-of-at-least-16-bytes";

describe("resolveClientAuthentication", () => {
  let context: PylonAuthDriverContext;

  const resolve = (
    method: Parameters<typeof resolveClientAuthentication>[1]["method"],
    overrides: Partial<Parameters<typeof resolveClientAuthentication>[1]> = {},
  ) =>
    resolveClientAuthentication(context, {
      assertion: { expiry: "1 minute", key: null },
      audience: "https://auth.lindorm.io/token",
      clientId: "client-id",
      clientSecret: SECRET,
      method,
      ...overrides,
    });

  beforeEach(() => {
    const logger = createMockLogger();
    const amphora = new Amphora({ logger });

    context = {
      aegis: new Aegis({ amphora, logger }),
      amphora,
      conduit: {} as never,
      environment: "test",
      logger,
    };
  });

  // The three methods that predate the assertion pair must be untouched by it.
  describe("secret-bearing methods", () => {
    test("should keep client_secret_basic in header middleware", async () => {
      const auth = await resolve("client_secret_basic");

      expect(auth.body).toEqual({});
      expect(auth.middleware).toHaveLength(1);
    });

    test("should put client_secret_post in the body", async () => {
      const auth = await resolve("client_secret_post");

      expect(auth.body).toEqual({ clientId: "client-id", clientSecret: SECRET });
      expect(auth.middleware).toEqual([]);
    });

    test("should send client_id alone for none", async () => {
      const auth = await resolve("none", { clientSecret: undefined });

      expect(auth.body).toEqual({ clientId: "client-id" });
      expect(auth.middleware).toEqual([]);
    });
  });

  describe("client_secret_jwt", () => {
    test("should compose the assertion parameters", async () => {
      const auth = await resolve("client_secret_jwt");

      expect(auth.body).toEqual({
        clientAssertion: expect.any(String),
        clientAssertionType: ASSERTION_TYPE,
        clientId: "client-id",
      });
      expect(auth.middleware).toEqual([]);
    });

    // The assertion IS the credential — there is nothing to MAC it with.
    test("should throw without a client secret", async () => {
      await expect(
        resolve("client_secret_jwt", { clientSecret: undefined }),
      ).rejects.toThrow(/Client secret is required for client_secret_jwt/);
    });
  });

  describe("private_key_jwt", () => {
    test("should compose the assertion parameters", async () => {
      const auth = await resolve("private_key_jwt", {
        assertion: {
          expiry: "1 minute",
          key: { kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES256" }) },
        },
      });

      expect(auth.body).toEqual({
        clientAssertion: expect.any(String),
        clientAssertionType: ASSERTION_TYPE,
        clientId: "client-id",
      });
      expect(auth.middleware).toEqual([]);
    });

    /**
     * The defence-in-depth guard behind negotiation: a driver that OVERRIDES
     * `tokenEndpointAuthMethod` can hand this layer `private_key_jwt` without a
     * key. Reaching for the deployment's default signing key would sign a
     * client assertion with whatever pylon signs its own tokens with — so it
     * fails by name instead.
     */
    test("should throw without a configured assertion key", async () => {
      await expect(resolve("private_key_jwt")).rejects.toThrow(
        /Client assertion key is required for private_key_jwt/,
      );
    });
  });

  test("should throw for a method it does not compose", async () => {
    await expect(resolve("tls_client_auth" as never)).rejects.toThrow(
      /Unknown client authentication method/,
    );
  });
});
