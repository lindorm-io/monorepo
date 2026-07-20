import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict, Predicate } from "@lindorm/types";
import { CwsKit } from "../../classes/CwsKit.js";
import { AegisError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import { applyOmit, type OmitMode } from "../utils/apply-omit.js";
import { createTemporalMatchers } from "../utils/jwt-temporal-matchers.js";
import { validate } from "../utils/validate.js";
import type { CwtWireClaims } from "../../types/index.js";
import { coseLabelToAlg } from "./alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "./cbor.js";
import { decodeCwtClaims, encodeCwtClaims } from "./cwt-claims.js";
import { COSE_TAG, decodeProtectedHeader } from "./structures.js";

/**
 * The CWT (RFC 8392) token core shared by the two claims-bearing kits — `CwtKit`
 * (COSE_Sign1, asymmetric) and `CwmKit` (COSE_Mac0, symmetric). The kits are the
 * thin, algClass-GATED public shells; this module is the wire-only body they
 * both delegate to (house rule: thin class wrappers over utility functions, no
 * duplication). The integrity structure itself lives one layer down in the sole
 * opaque signer `CwsKit`, which routes Sign1 vs Mac0 off the key's `algClass`.
 *
 * Everything here speaks the WIRE (COSE-name-keyed) claim dict — `cti`, not the
 * domain `tokenId` — exactly as `JwtKit` speaks the JOSE wire. The domain⇆wire
 * translation is the Aegis-side `CoseKit` boundary (the COSE twin of the JOSE
 * `JoseKit` seam), never the kit.
 */

/** The two claims-kit formats, used to namespace the structural error codes. */
export type CwtFormat = "cwt" | "cwm";

export type CwtSignOptions = {
  /** The full COSE `typ` media type (label 16, RFC 9596), e.g. `application/at+cwt`. */
  typ?: string;
  /**
   * Allow lindorm-proprietary COSE encodings. Threaded to BOTH the interop alg
   * gate and the claim codec, each keeping its own default when omitted: the alg
   * gate is STRICT by default (a private-use signing algorithm such as ML-DSA is
   * refused unless `true`, D5), while the claim codec defaults to compact
   * private-use integer labels (set `false` for interoperable string keys).
   * Verify is always lenient. See `encodeCwtClaims`.
   */
  proprietary?: boolean;
  /**
   * How empty claims are pruned before encoding. `"empty"` (default) drops
   * null/empty-string/empty-array/empty-object recursively; `"undefined"` drops
   * only undefined. Kept identical to the JOSE wire so a CWT and a JWT minted
   * from the same claims agree on what is present.
   */
  omit?: OmitMode;
};

export type CwtVerifyOptions = {
  /** When set, the token's `typ` must equal this exact media type. */
  typ?: string;
  /** Clock skew tolerance (seconds) for the in-kit temporal range check. */
  clockTolerance?: number;
};

export type CwtVerifyResult<C extends CwtWireClaims = CwtWireClaims> = {
  /**
   * The COSE-name-keyed WIRE claims (`iss`/`exp`/`cti`/…) the codec decoded —
   * NO domain translation. Temporal claims (`exp`/`nbf`/`iat`) are `Date`s (the
   * codec's "date" kind), the same form `JwtKit`'s temporal check consumes.
   */
  claims: C;
  protectedHeader: Map<number, unknown>;
  typ: string | undefined;
};

export type CwtDecoded = {
  /** The COSE structure inside the CWT (a COSE_Sign1 or COSE_Mac0 Tag). */
  cose: unknown;
  kid: string | undefined;
  algorithm: string | undefined;
  typ: string | undefined;
};

// A CWT may be the bare COSE object or wrapped in the CWT tag (61). Strip it.
const unwrapCwt = (value: unknown): unknown =>
  value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;

/**
 * TRANSFORM-FREE sign (R18): serialize the already-wire, COSE-name-keyed `claims`
 * dict verbatim (modulo the `omit` knob) into a CWT claims map, secure it with a
 * COSE structure (Sign1/Mac0 chosen by the key class inside `CwsKit`), and wrap
 * the result in the CWT tag (61). Injects NO envelope claims, derives no hash,
 * maps no name or case — the Aegis-side `CoseKit` owns all of that.
 */
export const signCwt = (
  kryptos: IKryptos,
  logger: ILogger,
  claims: Dict,
  options: CwtSignOptions,
): Buffer => {
  logger.debug("Minting CWT", { options });

  // The single `proprietary` flag threads to BOTH the claim codec and the CwsKit
  // alg gate. Each applies its own established default when it is omitted: the
  // codec keeps its compact-label default (`?? true`), while the alg gate is
  // strict by default (an omitted flag is falsy, so a private-use alg is refused).
  const payload = encodeCbor(
    encodeCwtClaims(applyOmit(claims, options.omit), {
      proprietary: options.proprietary,
    }),
  );

  const cose = new CwsKit({ kryptos, logger }).sign(payload, {
    typ: options.typ,
    proprietary: options.proprietary,
  });

  // Always emit the CWT tag (61); verify accepts tagged or untagged.
  return encodeCbor(new Tag(COSE_TAG.cwt, cose));
};

/**
 * WIRE verify: kid fail-fast + typ well-formedness + typ match + algorithm-match
 * (all folded from the removed kit `parse`, off the cheap header decode), then
 * signature/MAC (via `CwsKit`, which gates the structure by algClass), then the
 * temporal range (R10, validated IF PRESENT) and the caller `assert`, in one pass
 * over the WIRE claims. Returns the native WIRE payload; NO named matchers, NO
 * exp presence, NO domain translation — those are the Aegis verify path's job.
 */
export const verifyCwt = <C extends CwtWireClaims = CwtWireClaims>(
  kryptos: IKryptos,
  logger: ILogger,
  params: {
    format: CwtFormat;
    token: Buffer;
    assert?: Predicate<C>;
    clockTolerance: number;
    options: CwtVerifyOptions;
  },
): CwtVerifyResult<C> => {
  const { format, token, assert, clockTolerance, options } = params;

  const decoded = decodeCwt(token);

  // kid fail-fast: a token naming a kid different from the configured key cannot
  // verify, so reject it before the (expensive) signature cycle. Via Aegis the
  // handed key already matches; this protects the standalone case.
  if (decoded.kid && kryptos.id && decoded.kid !== kryptos.id) {
    throw new AegisError("Invalid token", {
      code: `${format}_kid_mismatch`,
      data: { kid: decoded.kid },
      debug: { expected: kryptos.id },
      title: "CWT Kid Mismatch",
      details:
        "The token's kid names a different key than the one configured on this kit, so it cannot be verified here.",
    });
  }

  // typ well-formedness: a PRESENT typ must be a CWT media type — the registered
  // `application/cwt` (RFC 8392, the COSE twin of JOSE's bare "JWT") or a
  // structured `<type>+cwt` — so a COSE object of another shape cannot pass as
  // this claims CWT. A typ-LESS token is accepted here — presence requiredness is
  // a DOMAIN/profile policy.
  const typ = decoded.typ;
  if (typ !== undefined && typ !== "application/cwt" && !typ.endsWith("+cwt")) {
    throw new AegisError("Invalid token", {
      code: `${format}_invalid_typ`,
      data: { typ },
      title: "CWT Invalid Typ",
      details:
        "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be verified as a CWT.",
    });
  }

  if (options.typ !== undefined && typ !== options.typ) {
    throw new AegisError("Invalid token", {
      code: `${format}_typ_mismatch`,
      data: { typ },
      debug: { expected: options.typ },
      title: "CWT Typ Mismatch",
      details: "The header typ does not match the typ expected during verification.",
    });
  }

  if (decoded.algorithm !== kryptos.algorithm) {
    throw new AegisError("Invalid token", {
      code: `${format}_algorithm_mismatch`,
      data: { algorithm: decoded.algorithm },
      debug: { expected: kryptos.algorithm },
      title: "CWT Algorithm Mismatch",
      details:
        "The protected header alg does not match the algorithm of the configured kryptos key.",
    });
  }

  const cose = unwrapCwt(decodeCbor(token));
  const { payload, protectedHeader } = new CwsKit({ kryptos, logger }).verify(cose);

  // preferMap:false so nested claim objects (act, sub_id, events, custom) decode
  // as plain objects; the top CWT map keeps integer keys so it stays a Map. The
  // codec yields the COSE-name-keyed WIRE (temporal claims as Dates).
  const wire = decodeCwtClaims(
    decodeCbor<Map<unknown, unknown>>(payload, { preferMap: false }),
  );

  // Temporal range (R10) — every temporal claim validated IF PRESENT — plus the
  // caller's wire `assert`, in one pass over the Date-typed wire claims.
  validate(wire, {
    ...createTemporalMatchers(clockTolerance),
    ...(assert ?? {}),
  } as Predicate<Dict>);

  logger.debug("CWT verified");

  const protectedTyp = protectedHeader.get(coseByJose("typ"));

  return {
    claims: wire as C,
    protectedHeader,
    typ: typeof protectedTyp === "string" ? protectedTyp : undefined,
  };
};

/**
 * Decode a CWT WITHOUT verifying — exposes the kid/alg/typ from the headers so
 * the caller can resolve the verification key before checking the signature.
 */
export const decodeCwt = (token: Buffer): CwtDecoded => {
  const cose = unwrapCwt(decodeCbor(token));
  const contents = cose instanceof Tag ? cose.contents : cose;

  if (!Array.isArray(contents) || contents.length < 2) {
    throw new AegisError("Malformed CWT", {
      code: "cose_malformed",
      title: "Malformed CWT",
      details: "The CWT does not contain a recognisable COSE structure.",
    });
  }

  const [protectedBstr, unprotected] = contents as [Uint8Array, Map<number, unknown>];
  const protectedHeader = decodeProtectedHeader(protectedBstr);

  const kidValue = unprotected.get(coseByJose("kid"));
  const algLabel = protectedHeader.get(coseByJose("alg"));
  const typ = protectedHeader.get(coseByJose("typ"));

  return {
    cose,
    kid:
      kidValue instanceof Uint8Array ? Buffer.from(kidValue).toString("utf8") : undefined,
    algorithm: typeof algLabel === "number" ? coseLabelToAlg(algLabel) : undefined,
    typ: typeof typ === "string" ? typ : undefined,
  };
};
