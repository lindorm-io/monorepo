import { Amphora, type IAmphora } from "@lindorm/amphora";
import { Kryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "../../__fixtures__/x509.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisKeyError } from "../../errors/index.js";
import { verifyCertBinding } from "./verify-cert-binding.js";

// The X.509 fixtures are valid from 2026-04-13, so the clock sits inside their
// window and no incidental validity check decides an outcome here.
MockDate.set(new Date("2026-06-01T12:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * THE POST-VERIFY CERTIFICATE BINDING CHECK.
 *
 * It runs AFTER the signature has been verified with the amphora-sourced key and
 * it is NOT a key-selection step: a header-supplied certificate is never a key
 * source. What it answers is narrower — does the certificate the token NAMES
 * match the certificate the verifying key actually holds.
 *
 * ⚠ The interesting cases cannot be conformance rows, and the reason is the
 * whole point of the check. Reaching the mismatch branch through a public door
 * needs a token whose header thumbprint is wrong AND whose signature is still
 * valid, and no caller can produce one — rewriting the header breaks the
 * signature, which is refused first (`a-token-whose-protected-header-was-altered
 * -after-signing-is-refused` states that). The STRANDED branch is reachable end
 * to end, and is exercised that way below, by replacing a vault key with a
 * chain-less twin that shares its material — which the scenario table has no
 * step for either.
 *
 * ⚠ The predecessor of this file asserted the mismatch through `aegis.jwt.verify`
 * on a hand-rewritten header with a bare `rejects.toThrow()`, and its own comment
 * conceded the signature broke first. That test passed with this function gutted.
 * Calling the function directly and asserting the code is what makes the branch
 * observable at all.
 */
const defaults = {
  notBefore: new Date("2020-01-01T00:00:00.000Z"),
  expiresAt: new Date("2120-01-01T00:00:00.000Z"),
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
  updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  issuer: ISSUER,
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
  algorithm: "ES256" as const,
  curve: "P-256" as const,
  type: "EC" as const,
  use: "sig" as const,
  internal: true,
  // amphora hands back published keys, and these are the keys a mint selects.
  publish: true,
  privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
  publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
};

const CHAIN = [TEST_X509_LEAF_PEM, TEST_X509_INTERMEDIATE_PEM, TEST_X509_ROOT_PEM];

/**
 * The two halves of a key ROTATION that lost its chain: same id, same key
 * material — so a token signed by the first still verifies against the second —
 * differing only in whether the chain is there to confirm the binding against.
 */
const SHARED_KID = "c0a1b2c3-0000-0000-0000-aegis-cert-shrd";

const certBound = (id: string): Kryptos =>
  new Kryptos({ ...defaults, id, certificateChain: CHAIN });

const chainless = (id: string): Kryptos => new Kryptos({ ...defaults, id });

const CERT_KEY = certBound("e1a4f9c0-0000-0000-0000-aegis-cert-key0");
const CHAINLESS_KEY = chainless("f2b5e0d1-0000-0000-0000-aegis-cert-key1");

const signContent = {
  expires: "1h" as const,
  subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
  tokenType: "access_token" as const,
};

describe("verifyCertBinding", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  // A token that names a certificate the verifying key does not hold is claiming
  // an identity it cannot prove. This is the branch a mode can never skip.
  describe("a thumbprint that does not match the verifying key's certificate", () => {
    test.each(["strict", "lax"] as const)("is refused in %s mode", (mode) => {
      const error = (() => {
        try {
          verifyCertBinding({
            header: {
              certificateThumbprint: "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
            },
            kryptos: CERT_KEY,
            logger,
            mode,
          });
          return undefined;
        } catch (err) {
          return err;
        }
      })();

      expect(error).toBeInstanceOf(AegisKeyError);
      expect((error as AegisKeyError).code).toBe("cert_binding_thumbprint_mismatch");
    });
  });

  /**
   * The STRANDED case: the token carries a binding and the verifying key has no
   * chain to confirm it against — a key that rotated, was cloned, or was
   * backfilled without its certificates. The two modes take the two defensible
   * positions and nothing in between: strict refuses because the binding cannot
   * be proven, lax accepts because the SIGNATURE already was.
   */
  describe("a thumbprint the verifying key has no chain to confirm", () => {
    test("is refused in strict mode", () => {
      const error = (() => {
        try {
          verifyCertBinding({
            header: { certificateThumbprint: "abc" },
            kryptos: CHAINLESS_KEY,
            logger,
            mode: "strict",
          });
          return undefined;
        } catch (err) {
          return err;
        }
      })();

      expect(error).toBeInstanceOf(AegisKeyError);
      expect((error as AegisKeyError).code).toBe("cert_binding_chain_missing");
    });

    test("passes through in lax mode, and says so", () => {
      expect(() =>
        verifyCertBinding({
          header: { certificateThumbprint: "abc" },
          kryptos: CHAINLESS_KEY,
          logger,
          mode: "lax",
        }),
      ).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("lax mode"),
        expect.objectContaining({ kryptosId: CHAINLESS_KEY.id }),
      );
    });
  });

  // A token that makes no binding claim is not being checked for one. Treating
  // absence as a failure would refuse every ordinary token the moment a
  // deployment's keys grew a chain.
  describe("a token that carries no thumbprint", () => {
    test.each(["strict", "lax"] as const)("is a no-op in %s mode", (mode) => {
      expect(() =>
        verifyCertBinding({
          header: { certificateThumbprint: undefined },
          kryptos: CHAINLESS_KEY,
          logger,
          mode,
        }),
      ).not.toThrow();

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});

/**
 * The same rule reached through the public verify door, with the stranding
 * produced the way a deployment produces it: the key is replaced under its own
 * id by a chain-less twin holding the same material, so the signature still
 * verifies and only the binding check can fail.
 */
describe("certBindingMode — end to end", () => {
  let amphora: IAmphora;
  // Every message the deployment logs, at any level and from any CHILD logger.
  // `Aegis` logs through `logger.child(...)`, so asserting on the root mock's own
  // `warn` would assert on a function nothing in the pipeline ever calls.
  let logged: Array<string>;

  const build = async (mode?: "strict" | "lax"): Promise<Aegis> => {
    logged = [];

    const logger = createMockLogger((message: string) => {
      logged.push(message);
    });

    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    await amphora.setup();

    return new Aegis({ amphora, logger, ...(mode ? { certBindingMode: mode } : {}) });
  };

  beforeEach(() => {
    MockDate.set(new Date("2026-06-01T12:00:00.000Z"));
  });

  // Strict is the DEFAULT, and the default is the security-relevant half: a
  // deployment that never states a mode must still refuse a binding it cannot
  // confirm.
  test.each([undefined, "strict"] as const)(
    "refuses a stranded token when the mode is %s",
    async (mode) => {
      const aegis = await build(mode);
      amphora.add(certBound(SHARED_KID));

      const { token } = await aegis.mint("default", signContent);

      // The chain is lost AFTER signing — same id, same material.
      amphora.add(chainless(SHARED_KID));

      await expect(aegis.jwt.verify(token)).rejects.toMatchObject({
        code: "cert_binding_chain_missing",
      });
    },
  );

  test("lets a stranded token through in lax mode, with a warning that names the parameter", async () => {
    const aegis = await build("lax");
    amphora.add(certBound(SHARED_KID));

    const { token } = await aegis.mint("default", signContent);

    amphora.add(chainless(SHARED_KID));

    await expect(aegis.jwt.verify(token)).resolves.toBeDefined();

    // The warning is the whole compensating control for what lax skips, so it
    // has to name the parameter that went unchecked — an operator reading
    // "passed through" alone learns nothing actionable.
    expect(logged.filter((message) => message.includes("x5t#S256"))).not.toEqual([]);
    expect(logged.filter((message) => message.includes("lax mode"))).not.toEqual([]);
  });

  // Neither mode touches a token that carries no binding — the mode governs what
  // to do about a claim, not whether a claim must be made.
  test.each(["strict", "lax"] as const)(
    "leaves a token carrying no binding alone in %s mode",
    async (mode) => {
      const aegis = await build(mode);
      amphora.add(CHAINLESS_KEY);

      const { token } = await aegis.mint("default", signContent);

      await expect(aegis.jwt.verify(token)).resolves.toBeDefined();
    },
  );
});
