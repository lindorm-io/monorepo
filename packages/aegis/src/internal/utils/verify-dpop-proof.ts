import { isNumber, isString } from "@lindorm/is";
import { KryptosKit } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import { AegisDomainError } from "../../errors/index.js";
import type { ParsedDpopProof } from "../../types/domain/delegation.js";
import { computeJwkThumbprint } from "./compute-jwk-thumbprint.js";
import { decodeJoseHeader } from "./jose-header.js";
import { verifyJoseSignature } from "./jose-signature.js";
import { decodeJwtPayload } from "./jwt-payload.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";
import { isClaimSatisfied } from "./rules/is-claim-satisfied.js";

type Options = {
  proof: string;
  accessToken: string;
  expectedThumbprint: string;
  dpopMaxSkew: number;
  /**
   * The custom header parameters the caller takes responsibility for, WIRE-named:
   * the domain door has already translated its `critical` declaration
   * (`internal/header/declared-crit-to-wire.ts`). `undefined` declares nothing.
   * ⚠ REQUIRED, not optional, for the reason `apply-verify-policy.ts` gives on
   * its `crit`.
   */
  declared: ReadonlyArray<string> | undefined;
};

type DpopProofPayload = {
  jti?: unknown;
  htm?: unknown;
  htu?: unknown;
  iat?: unknown;
  ath?: unknown;
  nonce?: unknown;
};

// A required proof claim must be a NON-EMPTY string — the demand notion, spelled
// as `require-present` spells it, so the question is named once across the
// package rather than open-coded here as a bare `typeof` plus a length test.
const assertString = (value: unknown, claim: string): string => {
  if (!(isString(value) && isClaimSatisfied(value))) {
    throw new AegisDomainError(`Invalid DPoP proof: "${claim}" claim is required`, {
      code: "dpop_claim_required",
      data: { claim },
      title: "JWT DPoP Claim Required",
      details:
        "A required DPoP proof claim (jti, htm, or htu) was missing or not a non-empty string.",
    });
  }
  return value;
};

export const verifyDpopProof = (options: Options): ParsedDpopProof => {
  const { proof, accessToken, expectedThumbprint, dpopMaxSkew, declared } = options;

  const parts = proof.split(".");
  if (parts.length !== 3) {
    throw new AegisDomainError("Invalid DPoP proof: not a compact JWS", {
      code: "dpop_not_compact_jws",
      title: "JWT DPoP Not Compact JWS",
      details:
        "The DPoP proof must be a compact JWS with exactly three dot-separated segments.",
    });
  }
  const [headerB64, payloadB64] = parts;

  const { header, custom } = decodeJoseHeader(headerB64);

  if (header.typ !== "dpop+jwt") {
    throw new AegisDomainError("Invalid DPoP proof: header typ must be dpop+jwt", {
      code: "dpop_invalid_typ",
      data: { typ: header.typ },
      title: "JWT DPoP Invalid Typ",
      details: "The DPoP proof header typ must be exactly dpop+jwt. RFC 9449 §4.2.",
    });
  }

  // The `crit` gate every JOSE verify door runs — after `typ`, as the kits do,
  // and ahead of the key material and the signature (RFC 7515 §4.1.11). Called
  // directly rather than through `assertProtectedHeaderGates`: the proof carries
  // its own key, so there is no configured algorithm to match. BOTH bags go in —
  // a crit-listed extension lands in `custom`, and judged on `header` alone it
  // reads as a parameter the proof does not carry.
  rejectUnknownCritical({
    header,
    custom,
    declared,
    format: "dpop",
    name: "JWT DPoP",
    remedy:
      "Name the parameter in the critical option of verifyDpopProof, or of the verify call carrying the proof, to accept it.",
    error: AegisDomainError,
  });

  if (!header.jwk) {
    throw new AegisDomainError("Invalid DPoP proof: header jwk is required", {
      code: "dpop_jwk_required",
      title: "JWT DPoP JWK Required",
      details:
        "The DPoP proof header must carry a jwk so its thumbprint can be matched against cnf.jkt.",
    });
  }

  const rawJwk = header.jwk as Record<string, unknown>;

  // RFC 7638 thumbprint from the raw JWK — uses only canonical key-material
  // fields (kty/crv/x/y for EC, kty/e/n for RSA, kty/crv/x for OKP).
  const thumbprint = computeJwkThumbprint(rawJwk);

  if (thumbprint !== expectedThumbprint) {
    throw new AegisDomainError("Invalid DPoP proof: thumbprint does not match cnf.jkt", {
      code: "dpop_thumbprint_mismatch",
      debug: { expected: expectedThumbprint, actual: thumbprint },
      title: "JWT DPoP Thumbprint Mismatch",
      details:
        "The RFC 7638 thumbprint of the proof header jwk does not match the token's bound cnf.jkt thumbprint.",
    });
  }

  // Signature verification needs a Kryptos instance: the SignatureKit dispatch
  // chain (EcKit/RsaKit/OkpKit) is coupled to IKryptos. The proof JWK carries key
  // material only, so `alg` comes from the JOSE header (RFC 9449) and `use` is
  // `"sig"`.
  const proofKryptos = KryptosKit.from.jwk({
    ...rawJwk,
    alg: header.alg,
    use: "sig",
  } as Parameters<typeof KryptosKit.from.jwk>[0]);

  if (!verifyJoseSignature(proofKryptos, proof)) {
    throw new AegisDomainError("Invalid DPoP proof: signature verification failed", {
      code: "dpop_signature_invalid",
      title: "JWT DPoP Signature Invalid",
      details:
        "The DPoP proof signature did not verify against the key embedded in its jwk header.",
    });
  }

  const payload = decodeJwtPayload<DpopProofPayload>(payloadB64);

  const tokenId = assertString(payload.jti, "jti");
  const httpMethod = assertString(payload.htm, "htm");
  const httpUri = assertString(payload.htu, "htu");

  if (!isNumber(payload.iat)) {
    throw new AegisDomainError("Invalid DPoP proof: iat claim is required", {
      code: "dpop_iat_required",
      title: "JWT DPoP IAT Required",
      details:
        "The DPoP proof must carry a numeric iat claim so its freshness can be checked.",
    });
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - payload.iat) > dpopMaxSkew) {
    throw new AegisDomainError(
      "Invalid DPoP proof: iat is outside the allowed skew window",
      {
        code: "dpop_iat_skew",
        data: { iat: payload.iat, now, dpopMaxSkew },
        title: "JWT DPoP IAT Skew",
        details:
          "The DPoP proof iat differs from the current time by more than the configured dpopMaxSkew window.",
      },
    );
  }

  const expectedAth = ShaKit.S256(accessToken);
  if (payload.ath !== expectedAth) {
    throw new AegisDomainError(
      "Invalid DPoP proof: ath does not match access token hash",
      {
        code: "dpop_ath_mismatch",
        title: "JWT DPoP ATH Mismatch",
        details:
          "The DPoP proof ath claim does not equal the SHA-256 hash of the presented access token.",
      },
    );
  }

  return {
    thumbprint,
    tokenId,
    httpMethod,
    httpUri,
    issuedAt: new Date(payload.iat * 1000),
    accessTokenHash: expectedAth,
    nonce: isString(payload.nonce) ? payload.nonce : undefined,
  };
};
