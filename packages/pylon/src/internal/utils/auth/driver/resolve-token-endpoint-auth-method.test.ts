import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { beforeEach, describe, expect, test } from "vitest";
import { resolveTokenEndpointAuthMethod } from "./resolve-token-endpoint-auth-method.js";

const KEY = { kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES256" }) };

describe("resolveTokenEndpointAuthMethod", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  /**
   * The preference order is by what a compromise costs. Asymmetric proof first
   * (the provider stores only a public key), then the MAC'd assertion (the
   * secret never crosses the wire), then the two that put the secret itself on
   * it — header before body, because the `Authorization` header is what log
   * scrubbers already redact.
   */
  describe("preference order", () => {
    test("should pick private_key_jwt over every secret-bearing method", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          assertionKey: KEY,
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          supported: [
            "client_secret_basic",
            "client_secret_jwt",
            "client_secret_post",
            "private_key_jwt",
          ],
        }),
      ).toBe("private_key_jwt");
    });

    test("should pick client_secret_jwt over the plaintext-secret methods", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          assertionKey: KEY,
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          supported: ["client_secret_basic", "client_secret_jwt", "client_secret_post"],
        }),
      ).toBe("client_secret_jwt");
    });

    test("should pick client_secret_basic over client_secret_post", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          supported: ["client_secret_post", "client_secret_basic"],
        }),
      ).toBe("client_secret_basic");
    });

    test("should take client_secret_post when it is the only advertised method", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          assertionKey: KEY,
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          supported: ["client_secret_post"],
        }),
      ).toBe("client_secret_post");
    });

    // Capability comes from the driver: a driver carrying no assertion key
    // cannot compose private_key_jwt however loudly the provider advertises it.
    test("should skip private_key_jwt when the driver carries no assertion key", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          supported: ["private_key_jwt", "client_secret_post"],
        }),
      ).toBe("client_secret_post");
    });

    // ...and equally, a key-only client cannot compose the secret methods.
    test("should skip the secret methods when the driver carries no secret", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          assertionKey: KEY,
          logger,
          supported: ["client_secret_basic", "private_key_jwt"],
        }),
      ).toBe("private_key_jwt");
    });
  });

  describe("advertised nothing", () => {
    // OIDC Discovery §3 / RFC 8414 §2 — the spec default.
    test("should fall back to client_secret_basic", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
        }),
      ).toBe("client_secret_basic");
    });

    // The spec default needs a secret. A confidential client that authenticates
    // by KEY alone would be downgraded to `none` by taking it literally.
    test("should fall back to the strongest composable method for a key-only client", () => {
      expect(resolveTokenEndpointAuthMethod({ assertionKey: KEY, logger })).toBe(
        "private_key_jwt",
      );
    });
  });

  describe("nothing composable", () => {
    // RFC 8705 §2 mTLS is settled on the TLS handshake, not in a request — a
    // conduit concern. Pylon still sends the spec default and says so.
    test("should warn and fall back when the provider advertises only mTLS", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          supported: ["tls_client_auth", "self_signed_tls_client_auth"],
        }),
      ).toBe("client_secret_basic");

      expect(logger.warn).toHaveBeenCalledWith(
        "IdP advertises no client authentication method pylon can compose",
        {
          composable: ["client_secret_jwt", "client_secret_basic", "client_secret_post"],
          fallback: "client_secret_basic",
          supported: ["tls_client_auth", "self_signed_tls_client_auth"],
        },
      );
    });
  });

  describe("no credentials", () => {
    // Gap 2 — RFC 6749 §3.2.1 still requires `client_id`; that is what `none`
    // composes.
    test("should authenticate with client_id alone", () => {
      expect(
        resolveTokenEndpointAuthMethod({ logger, supported: ["client_secret_basic"] }),
      ).toBe("none");
    });

    test("should refuse to invent a credential a pinned method needs", () => {
      expect(resolveTokenEndpointAuthMethod({ logger, pinned: "private_key_jwt" })).toBe(
        "none",
      );
    });
  });

  describe("pinned", () => {
    test("should honour a pinned method the driver can compose", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          assertionKey: KEY,
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          pinned: "private_key_jwt",
          supported: ["client_secret_basic"],
        }),
      ).toBe("private_key_jwt");
    });

    // An operator may decline to present credentials it holds.
    test("should honour a pinned none even for a client that holds credentials", () => {
      expect(
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          pinned: "none",
        }),
      ).toBe("none");
    });

    // Pinning states intent. Silently sending a plaintext secret instead of the
    // asymmetric proof asked for is a downgrade, so it throws.
    test("should throw when private_key_jwt is pinned without an assertion key", () => {
      expect(() =>
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          pinned: "private_key_jwt",
        }),
      ).toThrow(/Token endpoint auth method is not supported/);
    });

    test("should throw when a pinned method is not one pylon spells at all", () => {
      expect(() =>
        resolveTokenEndpointAuthMethod({
          clientSecret: "a-client-secret-of-sufficient-length",
          logger,
          pinned: "tls_client_auth",
        }),
      ).toThrow(/Token endpoint auth method is not supported/);
    });
  });
});
