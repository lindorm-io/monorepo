import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { AegisKeyError } from "../../errors/index.js";
import type { CertificateBindingMode } from "../../types/index.js";

/**
 * A binding the DOMAIN HEADER HAS NO FIELD FOR, already resolved to a verdict by
 * the wire that decoded it.
 *
 * RFC 9360 §2's `COSE_CertHash` carries its hash algorithm as a member of the
 * VALUE, so a COSE token may bind under an algorithm JOSE has no parameter for —
 * RFC 7517 §4.8/§4.9 register exactly two. There is no domain field such a digest
 * could travel in and no string for {@link verifyCertBinding} to compare, so
 * `internal/cose/cose-wide-cert-binding.ts` performs the comparison against the
 * leaf DER it holds and hands the ANSWER here.
 *
 * That is what keeps this function wire-agnostic: it decides what a MODE does
 * about a binding, never how a wire spells one.
 */
export type ComputedCertBinding = {
  /** The hash algorithm the token named, as the COSE registry spells it. */
  algorithm: string;
  /**
   * `undefined` where the verifying key holds NO certificate to hash — the same
   * unprovable state an absent chain puts a SHA-256 binding in, and answered by
   * the same policy.
   */
  matches: boolean | undefined;
};

type VerifyCertBindingOptions = {
  /**
   * The two digests a token can bind with, in DOMAIN vocabulary — which is what
   * keeps this function WIRE-AGNOSTIC. JOSE carries them as two parameters
   * (RFC 7515 §4.1.8 `x5t#S256` and §4.1.7 `x5t`); COSE carries ONE
   * (RFC 9360 §2's `x5t`, label 34) whose hash algorithm is a member of the value
   * and is dispatched onto these same two fields by
   * `internal/cose/cose-cert-hash.ts`. Both wires arrive here in one shape.
   */
  header: {
    certificateThumbprint: string | undefined;
    certificateThumbprintSha1: string | undefined;
  };
  /**
   * The wire's own verdict on a binding {@link header} cannot express. Absent on
   * JOSE, which has a parameter for every digest it can carry.
   */
  computed?: ComputedCertBinding;
  kryptos: IKryptos;
  logger: ILogger;
  mode: CertificateBindingMode;
};

/**
 * POST-VERIFY CONTENT TAMPER CHECK.
 *
 * This runs AFTER the signature/MAC/AEAD has already been verified with the
 * amphora-sourced kryptos. It is NOT a key selection step. Header cert fields
 * remain forbidden as key sources — see the SECURITY INVARIANT in
 * `Aegis.kryptosSig`.
 *
 * WHAT EACH MODE DOES WITH WHAT THE HEADER CARRIES:
 *
 * | the token binds with     | strict             | lax                          |
 * |--------------------------|--------------------|------------------------------|
 * | SHA-256                  | checked            | checked                      |
 * | SHA-256 and SHA-1        | SHA-256 checked    | SHA-256 checked              |
 * | SHA-384 / SHA-512 (COSE) | checked            | checked                      |
 * | SHA-1 alone              | REFUSED            | compared, and WARNED, always |
 * | nothing                  | nothing to check   | nothing to check             |
 *
 * ⚠ THERE IS NO "UNCHECKABLE ALGORITHM" ROW, and the absence is the honest
 * statement rather than a gap in the table. Every algorithm aegis implements is
 * checked; one it does not implement has no digest ANYWHERE in this function's
 * inputs — the codec drops it from the header and the wide resolver answers
 * `undefined` — so there is no state for a mode to act on. Widening the set is
 * what shrinks that boundary; see
 * `internal/cose/cose-hash-algorithms.ts#HASH_ALGORITHM`, which is the one place
 * that says which algorithms exist here.
 *
 * ⚠ WHERE BOTH RIDE, SHA-256 WINS AND THE SHA-1 IS IGNORED WITHOUT A WARNING —
 * and that is the COMMON case, not an edge: every cert-bound JOSE token aegis
 * writes carries `x5t` beside `x5t#S256` (`resolve-cert-binding.ts`).
 * The strong binding was present and verified, so there is nothing unproven to
 * warn about, and cross-checking the legacy digest would add a second failure mode
 * with no security gain.
 *
 * ⚠ A LAX SHA-1 COMPARISON WARNS EVERY TIME IT HAPPENS, including on success.
 * Without that, "binding verified" would silently mean two different strengths.
 *
 * ⚠ A MISMATCH IS A HARD FAIL IN BOTH MODES. `lax` widens what may go UNPROVEN
 * (a chain the verifying key no longer holds; a digest whose algorithm is
 * discouraged), never what may be WRONG.
 */
export const verifyCertBinding = ({
  header,
  computed,
  kryptos,
  logger,
  mode,
}: VerifyCertBindingOptions): void => {
  // ONE read, for both arms below. `null` is the key that carries no certificate
  // at all — the accessor answers that rather than throwing.
  const certificate = kryptos.certificate("b64");

  if (header.certificateThumbprint !== undefined) {
    if (certificate === null) {
      if (mode === "strict") {
        throw new AegisKeyError(
          "token header x5t#S256 present but signing kryptos has no certificateChain",
          {
            code: "cert_binding_chain_missing",
            debug: { kryptosId: kryptos.id },
            title: "Cert Binding Chain Missing",
            details:
              "The token header carries an x5t#S256 thumbprint, but the verifying kryptos has no certificateChain to confirm the binding in strict mode.",
          },
        );
      }

      logger.warn(
        "Cert binding: token header x5t#S256 present but signing kryptos has no certificateChain (lax mode — passing through)",
        { kryptosId: kryptos.id },
      );
      return;
    }

    if (header.certificateThumbprint !== certificate.thumbprint) {
      throw new AegisKeyError("signing certificate thumbprint mismatch", {
        code: "cert_binding_thumbprint_mismatch",
        debug: {
          expected: certificate.thumbprint,
          received: header.certificateThumbprint,
        },
        title: "Cert Binding Thumbprint Mismatch",
        details:
          "The token header x5t#S256 does not match the certificateThumbprint of the verifying kryptos.",
      });
    }

    return;
  }

  // THE WIDE BINDING, between the two string comparisons because that is its
  // strength: SHA-384/512 are stronger than SHA-256 but only COSE can carry one,
  // and a COSE token binds with exactly ONE digest (a CBOR map cannot key label 34
  // twice), so on any real token at most one of these three branches has an input.
  if (computed !== undefined) {
    if (computed.matches === undefined) {
      if (mode === "strict") {
        throw new AegisKeyError(
          `token binds a certificate with a ${computed.algorithm} thumbprint but signing kryptos has no certificateChain`,
          {
            code: "cert_binding_chain_missing",
            debug: { kryptosId: kryptos.id, algorithm: computed.algorithm },
            title: "Cert Binding Chain Missing",
            details:
              "The token carries a certificate thumbprint, but the verifying kryptos has no certificateChain to confirm the binding in strict mode.",
          },
        );
      }

      logger.warn(
        `Cert binding: token binds with a ${computed.algorithm} thumbprint but signing kryptos has no certificateChain (lax mode — passing through)`,
        { kryptosId: kryptos.id },
      );
      return;
    }

    if (!computed.matches) {
      throw new AegisKeyError("signing certificate thumbprint mismatch", {
        code: "cert_binding_thumbprint_mismatch",
        debug: { kryptosId: kryptos.id, algorithm: computed.algorithm },
        title: "Cert Binding Thumbprint Mismatch",
        details:
          "The certificate thumbprint the token carries does not match a digest of the verifying kryptos's own leaf certificate.",
      });
    }

    // A verified binding under an algorithm at least as strong as SHA-256, so
    // there is nothing unproven to warn about — the silence the SHA-256 arm keeps.
    return;
  }

  if (header.certificateThumbprintSha1 === undefined) return;

  // ⚠⚠ STRICT IS THE DEFAULT (`Aegis.ts`, `JwsKit`, `JwtKit`, `JweKit` and the
  // COSE kits all resolve `?? "strict"`), so a third-party token bound with the
  // SHA-1 digest ALONE is REFUSED unless the consumer states
  // `certBindingMode: "lax"`. Pinned in `verify-cert-binding.test.ts`.
  //
  // A DISTINCT code from `cert_binding_chain_missing`: a refusal of a weak
  // algorithm is a different fact from a chain the verifier does not hold, and
  // reusing the code mislabels the failure for anyone bracketing on it.
  if (mode === "strict") {
    throw new AegisKeyError("token binds a certificate with a SHA-1 thumbprint only", {
      code: "cert_binding_weak_algorithm",
      debug: { kryptosId: kryptos.id },
      title: "Cert Binding Weak Algorithm",
      details:
        "The token binds its certificate with the SHA-1 thumbprint alone (RFC 7515 §4.1.7 x5t / a COSE_CertHash under RFC 9054's SHA-1 label), whose digest is no longer collision-resistant. Strict mode expects the SHA-256 binding; a deployment that must accept the legacy digest sets certBindingMode to lax.",
    });
  }

  if (certificate === null) {
    logger.warn(
      "Cert binding: token binds with a SHA-1 thumbprint only and the signing kryptos has no certificateChain (lax mode — passing through)",
      { kryptosId: kryptos.id },
    );
    return;
  }

  if (header.certificateThumbprintSha1 !== certificate.thumbprintSha1) {
    throw new AegisKeyError("signing certificate thumbprint mismatch", {
      code: "cert_binding_thumbprint_mismatch",
      debug: {
        expected: certificate.thumbprintSha1,
        received: header.certificateThumbprintSha1,
      },
      title: "Cert Binding Thumbprint Mismatch",
      details:
        "The token header SHA-1 certificate thumbprint does not match the certificateThumbprintSha1 of the verifying kryptos.",
    });
  }

  logger.warn(
    "Cert binding: verified against the SHA-1 thumbprint alone (lax mode — the token carries no SHA-256 binding)",
    { kryptosId: kryptos.id },
  );
};
