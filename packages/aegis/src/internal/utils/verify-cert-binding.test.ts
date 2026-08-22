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
 * ⚠ AN ATTACKER CANNOT REACH THE MISMATCH BRANCH, and that is the point of the
 * check rather than a gap in it: a token whose header thumbprint is wrong and
 * whose signature is still valid requires the SIGNING KEY, since rewriting the
 * header breaks the signature and is refused first
 * (`a-token-whose-protected-header-was-altered-after-signing-is-refused` states
 * that). A TEST holding the private key can produce one, and
 * `classes/cose-cert-binding.test.ts` does — it rewrites label 34 and RE-SIGNS
 * over the rewritten protected bucket, which is how the COSE wide-digest rows
 * reach the mismatch end to end.
 *
 * ⚠ THE ROWS BELOW CALL THIS FUNCTION DIRECTLY, and the code is asserted rather
 * than a bare `rejects.toThrow()`. A rejection reached through a public door is
 * satisfied by the signature check firing first, so it would pass with this
 * function gutted. The STRANDED branch is the one that IS reachable end to end —
 * by replacing a vault key with a chain-less twin that shares its material — and
 * is exercised that way at the foot of this file.
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
              certificateThumbprintSha1: undefined,
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
            header: {
              certificateThumbprint: "abc",
              certificateThumbprintSha1: undefined,
            },
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
          header: {
            certificateThumbprint: "abc",
            certificateThumbprintSha1: undefined,
          },
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

  /**
   * ⭐⭐ THE SHA-1-ONLY BINDING — reachable on the COSE wire through label 34's
   * `hashAlg` (RFC 9360 §2), and on JOSE from a foreign producer emitting `x5t`
   * alone.
   *
   * Strict REFUSES (RFC 9054 §3.1): a binding resting on SHA-1 alone is not the
   * strong attribution a strict verifier expects. Lax COMPARES it — a mismatch is
   * still a hard fail — and WARNS every time, or "binding verified" would silently
   * mean two different strengths.
   */
  describe("a binding made with the SHA-1 thumbprint alone", () => {
    const sha1Header = (value: string) => ({
      certificateThumbprint: undefined,
      certificateThumbprintSha1: value,
    });

    // ⚠⚠ THE NAMED BREAK. `certBindingMode` defaults to `"strict"`, so a
    // third-party token bound this way is refused unless a consumer opts into lax.
    test("is refused in strict mode, even when it MATCHES", () => {
      const error = (() => {
        try {
          verifyCertBinding({
            header: sha1Header(CERT_KEY.certificate("b64")!.thumbprintSha1),
            kryptos: CERT_KEY,
            logger,
            mode: "strict",
          });
          return undefined;
        } catch (err) {
          return err;
        }
      })();

      expect(error).toBeInstanceOf(AegisKeyError);
      expect((error as AegisKeyError).code).toBe("cert_binding_weak_algorithm");
    });

    test("is compared in lax mode, and the comparison is always announced", () => {
      expect(() =>
        verifyCertBinding({
          header: sha1Header(CERT_KEY.certificate("b64")!.thumbprintSha1),
          kryptos: CERT_KEY,
          logger,
          mode: "lax",
        }),
      ).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("SHA-1"),
        expect.objectContaining({ kryptosId: CERT_KEY.id }),
      );
    });

    // Lax widens what may go UNPROVEN, never what may be WRONG.
    test("is refused in lax mode when it does not match", () => {
      const error = (() => {
        try {
          verifyCertBinding({
            header: sha1Header("ZZZZZZZZZZZZZZZZZZZZZZZZZZZ"),
            kryptos: CERT_KEY,
            logger,
            mode: "lax",
          });
          return undefined;
        } catch (err) {
          return err;
        }
      })();

      expect(error).toBeInstanceOf(AegisKeyError);
      expect((error as AegisKeyError).code).toBe("cert_binding_thumbprint_mismatch");
    });

    test("passes through in lax mode when the verifying key has no chain", () => {
      expect(() =>
        verifyCertBinding({
          header: sha1Header("abc"),
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

  /**
   * BOTH DIGESTS — the COMMON case on JOSE, where aegis emits `x5t` beside
   * `x5t#S256` by default. The SHA-256 binding was present and verified, so the
   * legacy digest is neither checked nor complained about: cross-checking it would
   * add a second failure mode with no security gain.
   */
  describe("a binding carrying both digests", () => {
    test.each(["strict", "lax"] as const)(
      "checks only the SHA-256 one, silently, in %s mode",
      (mode) => {
        expect(() =>
          verifyCertBinding({
            header: {
              certificateThumbprint: CERT_KEY.certificate("b64")!.thumbprint,
              // A SHA-1 value that matches nothing. If it were consulted at all,
              // this row would fail.
              certificateThumbprintSha1: "ZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
            },
            kryptos: CERT_KEY,
            logger,
            mode,
          }),
        ).not.toThrow();

        expect(logger.warn).not.toHaveBeenCalled();
      },
    );
  });

  /**
   * ⭐⭐ THE VERDICT ARM — a binding the DOMAIN HEADER HAS NO FIELD FOR.
   *
   * A COSE token can bind under SHA-384 or SHA-512 (RFC 9360 §2, RFC 9054 §3.2),
   * which no JOSE parameter has a domain field for (RFC 7515 §4.1.7, RFC 7515 §4.1.8).
   * The COSE read path resolves the comparison and hands the ANSWER here, which is
   * what lets this function stay wire-agnostic.
   *
   * ⚠ EVERY ARM IS EXERCISED HERE, at the unit, because each is a different
   * DECISION and the end-to-end rows can only reach them one token at a time.
   */
  describe("a binding resolved by the wire to a verdict", () => {
    const computed = (matches: boolean | undefined) => ({
      algorithm: "SHA-512",
      matches,
    });

    // A verified binding under an algorithm at least as strong as SHA-256 — so it
    // passes in SILENCE. A warning here would train operators to ignore warnings.
    test.each(["strict", "lax"] as const)(
      "passes a MATCH silently in %s mode",
      (mode) => {
        expect(() =>
          verifyCertBinding({
            header: {
              certificateThumbprint: undefined,
              certificateThumbprintSha1: undefined,
            },
            computed: computed(true),
            kryptos: CERT_KEY,
            logger,
            mode,
          }),
        ).not.toThrow();

        expect(logger.warn).not.toHaveBeenCalled();
      },
    );

    // A mismatch is a hard fail in BOTH modes: lax widens what may go UNPROVEN,
    // never what may be WRONG.
    test.each(["strict", "lax"] as const)("refuses a MISMATCH in %s mode", (mode) => {
      const error = (() => {
        try {
          verifyCertBinding({
            header: {
              certificateThumbprint: undefined,
              certificateThumbprintSha1: undefined,
            },
            computed: computed(false),
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
      expect((error as AegisKeyError).debug).toMatchObject({ algorithm: "SHA-512" });
    });

    // `matches: undefined` is ASSERTED-BUT-UNPROVABLE, not a mismatch — the same
    // state an absent chain puts a SHA-256 binding in, answered the same way.
    test("refuses an UNPROVABLE binding in strict mode", () => {
      const error = (() => {
        try {
          verifyCertBinding({
            header: {
              certificateThumbprint: undefined,
              certificateThumbprintSha1: undefined,
            },
            computed: computed(undefined),
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

    /**
     * ⚠ THE WARNING IS THE ASSERTION. Lax accepts a binding it cannot prove, so
     * the log line is the only compensating control a deployment has — and it must
     * NAME the algorithm, or an operator reading "passed through" learns nothing
     * about what went unchecked.
     */
    test("passes an UNPROVABLE binding in lax mode, naming the algorithm", () => {
      expect(() =>
        verifyCertBinding({
          header: {
            certificateThumbprint: undefined,
            certificateThumbprintSha1: undefined,
          },
          computed: computed(undefined),
          kryptos: CHAINLESS_KEY,
          logger,
          mode: "lax",
        }),
      ).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("SHA-512"),
        expect.objectContaining({ kryptosId: CHAINLESS_KEY.id }),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("lax mode"),
        expect.anything(),
      );
    });

    /**
     * PRECEDENCE. A COSE token binds with exactly one digest (a CBOR map cannot key
     * label 34 twice), so this pairing cannot arrive from a real wire — but the
     * order is a decision this function makes, and an untested one drifts. SHA-256
     * is present and verified, so the verdict is not consulted at all.
     */
    test("prefers a verified SHA-256 digest over the wire's verdict", () => {
      expect(() =>
        verifyCertBinding({
          header: {
            certificateThumbprint: CERT_KEY.certificate("b64")!.thumbprint,
            certificateThumbprintSha1: undefined,
          },
          computed: computed(false),
          kryptos: CERT_KEY,
          logger,
          mode: "strict",
        }),
      ).not.toThrow();
    });
  });

  // A token that makes no binding claim is not being checked for one. Treating
  // absence as a failure would refuse every ordinary token the moment a
  // deployment's keys grew a chain.
  describe("a token that carries no thumbprint", () => {
    test.each(["strict", "lax"] as const)("is a no-op in %s mode", (mode) => {
      expect(() =>
        verifyCertBinding({
          header: {
            certificateThumbprint: undefined,
            certificateThumbprintSha1: undefined,
          },
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
