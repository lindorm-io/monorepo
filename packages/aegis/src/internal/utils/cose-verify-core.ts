import { isString } from "@lindorm/is";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  isEncryptedCose,
} from "../cose/cose-encryption.js";
import { decodeCwt } from "../cose/cwt-token.js";
import { verifyCose } from "../cose/verify-cose.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The integrity core shared by the profile (`verifyProfileToken` → `verifyCoseToken`)
 * and profile-less (`verifyToken`) COSE paths: decrypt a COSE_Encrypt0 if present,
 * then resolve the signing/MAC key by kid (kid-only, never a header-embedded key)
 * and verify. The profile floor — if any — is applied by the caller.
 */
export const coseVerifyCore = async ({
  input,
  currentDate,
  maxTokenAge,
  verifyExpiration,
  verifyNotBefore,
  verifyIssuedAt,
  verifyAuthTime,
  deps,
  issuer,
}: {
  input: Buffer;
  /** Override "now" for the in-kit temporal range check (R10). Per-call only. */
  currentDate?: Date;
  /** Reject a token whose `iat` is older than this many seconds (R10). Per-call only. */
  maxTokenAge?: number;
  /** Range-check `exp` (default true). false ⇒ an EXPIRED CWT still verifies. */
  verifyExpiration?: boolean;
  /** Range-check `nbf` (default true). */
  verifyNotBefore?: boolean;
  /** Range-check `iat` (default true). */
  verifyIssuedAt?: boolean;
  /** Range-check `auth_time` (default true). */
  verifyAuthTime?: boolean;
  deps: AegisDeps;
  /**
   * The issuer the VERIFIER expects, when it declared one (profiled verify).
   * Takes precedence over the CWT's own `iss` when scoping the key lookup.
   */
  issuer?: string;
}) => {
  let bytes = input;

  // Whether the outer COSE was a COSE_Encrypt0 (cwe). Drives the read-side
  // sensitive-claim gate: sensitive claims (OIDC Core §13.3) surface only from
  // an encrypted CWT, and are suppressed on an unencrypted one.
  const encrypted = isEncryptedCose(bytes);

  if (encrypted) {
    // The CWE (COSE_Encrypt0) outer resolves UNSCOPED — its claims sit behind
    // the very key being resolved, exactly as for the outer JWE. The signed
    // inner CWT/CWM below IS scoped. See the unscoped-paths note in
    // `resolve-key.ts`.
    const encKryptos = await deps.resolveDecryptKey(
      decodeEncryptedCoseKid(bytes),
      undefined,
    );
    bytes = decryptCose({ kryptos: encKryptos, logger: deps.logger, token: bytes });
  }

  const decoded = decodeCwt(bytes);

  // Verifier-declared issuer wins; else the CWT's own UNVERIFIED `iss` (a
  // COSE_Sign1/Mac0 payload is cleartext CBOR); else unscoped. Narrowing only —
  // the same contract the JOSE paths use.
  const kryptos = await deps.resolveVerifyKey({
    id: decoded.kid,
    algorithm: undefined,
    issuer: issuer ?? (isString(decoded.payload?.iss) ? decoded.payload.iss : undefined),
  });
  const { claims, wire, typ } = verifyCose({
    kryptos,
    logger: deps.logger,
    token: bytes,
    clockTolerance: deps.clockTolerance,
    currentDate,
    maxTokenAge,
    verifyExpiration,
    verifyNotBefore,
    verifyIssuedAt,
    verifyAuthTime,
  });

  return { claims, wire, decoded, typ, encrypted };
};
