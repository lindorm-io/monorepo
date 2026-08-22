import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { AegisKeyError } from "../../errors/index.js";
import type { CertificateBindingMode } from "../../types/index.js";

/**
 * A binding the DOMAIN HEADER HAS NO FIELD FOR, already resolved to a verdict by
 * the wire that decoded it. RFC 9360 §2, RFC 7515 §4.1.7, RFC 7515 §4.1.8.
 *
 * A COSE token can bind under a hash algorithm no JOSE parameter exists for, so
 * the digest has no domain field to travel in and no string for
 * {@link verifyCertBinding} to compare. `internal/cose/cose-wide-cert-binding.ts`
 * does the comparison against the leaf DER it holds and hands the ANSWER here,
 * which is what keeps this function wire-agnostic: it decides what a MODE does
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
   * (RFC 7515 §4.1.8, RFC 7515 §4.1.7); COSE carries one (RFC 9360 §2, label 34),
   * dispatched onto these same two fields by `internal/cose/cose-cert-hash.ts`.
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
 * ⚠ THERE IS NO "UNCHECKABLE ALGORITHM" ROW: an algorithm aegis does not
 * implement has no digest anywhere in these inputs — the codec drops it from the
 * header and the wide resolver answers `undefined` — so no mode has state to act
 * on. `internal/cose/cose-hash-algorithms.ts#HASH_ALGORITHM` is the one place
 * saying which algorithms exist here.
 *
 * ⚠ WHERE BOTH RIDE, SHA-256 WINS AND THE SHA-1 IS IGNORED WITHOUT A WARNING —
 * the COMMON case, since every cert-bound JOSE token aegis writes carries `x5t`
 * beside `x5t#S256` (`resolve-cert-binding.ts`). Cross-checking the legacy digest
 * would add a second failure mode with no security gain.
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

  // THE WIDE BINDING, ordered by strength between the two string comparisons. A
  // COSE token binds with exactly ONE digest (a CBOR map cannot key label 34
  // twice), so at most one of these three branches ever has an input.
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
        "The token binds its certificate with the SHA-1 thumbprint alone — the JOSE x5t header parameter, or a COSE_CertHash under the SHA-1 algorithm label — and that digest is no longer collision-resistant. Strict mode expects the SHA-256 binding; a deployment that must accept the legacy digest sets certBindingMode to lax. RFC 7515 §4.1.7, RFC 9054 §3.1.",
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
