import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict, Predicate } from "@lindorm/types";
import { CwsKit } from "../../classes/CwsKit.js";
import { CoseError, CwmError, CwtError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import { mergeCoseWireHeader } from "../header/merge-cose-wire-header.js";
import { applyOmit } from "../utils/apply-omit.js";
import { buildMediaType } from "../utils/compute-typ-header.js";
import { createTemporalMatchers } from "../utils/jwt-temporal-matchers.js";
import { validate } from "../utils/validate.js";
import type {
  CwtClaimsWire,
  DecodedStructuredToken,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
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
 * translation is the Aegis-side `signCose`/`verifyCose` boundary (the COSE twin
 * of the JOSE `signJwtWire` seam), never the kit.
 */

/** The two claims-kit formats, used to namespace the structural error codes. */
export type CwtFormat = "cwt" | "cwm";

/**
 * The leaf error class for each claims-CWT format. The structural throws below
 * are namespaced by `format` (`cwt_*`/`cwm_*`), so they land on the matching
 * leaf (`CwtError`/`CwmError`) rather than the shared `CoseError` parent —
 * exactly as `JwtKit` throws `JwtError`. A caller may still catch the whole
 * family via `CoseError` (or `AegisError`).
 */
const CWT_ERROR: Record<CwtFormat, typeof CoseError> = {
  cwt: CwtError,
  cwm: CwmError,
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
 * maps no name or case — the Aegis-side `signCose` owns all of that.
 */
export const signCwt = (
  kryptos: IKryptos,
  logger: ILogger,
  format: CwtFormat,
  claims: Dict,
  options: SignStructuredTokenOptions,
): Buffer => {
  logger.debug("Minting CWT", { options });

  // The single `proprietary` flag threads to BOTH the claim codec and the CwsKit
  // alg gate, which now agree on the omitted default (D5): interoperable. The
  // codec emits private-use claims under their JOSE string key (`?? false`), and
  // the alg gate is strict (an omitted flag is falsy, so a private-use alg is
  // refused) — an on-platform token sets `proprietary: true` for both.
  const payload = encodeCbor(
    encodeCwtClaims(applyOmit(claims, options.omit), {
      proprietary: options.proprietary,
    }),
  );

  // `CwsKit.sign` returns the BARE encoded COSE_Sign1/Mac0 bytes; decode them back
  // to the COSE structure to frame it in the outer CWT tag (61). Verify accepts
  // tagged or untagged. The `typFormat` tells the shared opaque signer to stamp the
  // CWT media-type family (`+cwt`), not the opaque `+cws` one; the `tokenType`
  // prefix is threaded through and the kit computes the full media type.
  const cose = new CwsKit({ kryptos, logger, typFormat: format }).sign(payload, {
    tokenType: options.tokenType,
    proprietary: options.proprietary,
    header: options.header,
    unprotected: options.unprotected,
  });

  // Always emit the CWT tag (61); verify accepts tagged or untagged.
  return encodeCbor(new Tag(COSE_TAG.cwt, decodeCbor(cose)));
};

/**
 * WIRE verify: kid fail-fast + typ well-formedness + typ match + algorithm-match
 * (all folded from the removed kit `parse`, off the cheap header decode), then
 * signature/MAC (via `CwsKit`, which gates the structure by algClass), then the
 * temporal range (R10, validated IF PRESENT) and the caller `assert`, in one pass
 * over the WIRE claims. Returns the native WIRE payload; NO named matchers, NO
 * exp presence, NO domain translation — those are the Aegis verify path's job.
 */
export const verifyCwt = <C extends Dict = Dict>(
  kryptos: IKryptos,
  logger: ILogger,
  params: {
    format: CwtFormat;
    token: Buffer;
    assert?: Predicate<CwtClaimsWire & C>;
    clockTolerance: number;
    options: VerifyStructuredTokenOptions;
  },
): VerifiedStructuredToken<CwtClaimsWire & C, Buffer> => {
  const { format, token, assert, clockTolerance, options } = params;

  const decoded = decodeCwt(token);

  // kid fail-fast: a token naming a kid different from the configured key cannot
  // verify, so reject it before the (expensive) signature cycle. Via Aegis the
  // handed key already matches; this protects the standalone case.
  if (decoded.kid && kryptos.id && decoded.kid !== kryptos.id) {
    throw new CWT_ERROR[format]("Invalid token", {
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
    throw new CWT_ERROR[format]("Invalid token", {
      code: `${format}_invalid_typ`,
      data: { typ },
      title: "CWT Invalid Typ",
      details:
        "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be verified as a CWT.",
    });
  }

  // typ match: the kit builds the expected media type from the bare PREFIX it
  // re-wraps (the Aegis path derives the prefix from the domain tokenType).
  if (options.tokenType !== undefined) {
    const expected = buildMediaType(options.tokenType, format);
    if (typ !== expected) {
      throw new CWT_ERROR[format]("Invalid token", {
        code: `${format}_typ_mismatch`,
        data: { typ },
        debug: { expected },
        title: "CWT Typ Mismatch",
        details: "The header typ does not match the typ expected during verification.",
      });
    }
  }

  if (decoded.algorithm !== kryptos.algorithm) {
    throw new CWT_ERROR[format]("Invalid token", {
      code: `${format}_algorithm_mismatch`,
      data: { algorithm: decoded.algorithm },
      debug: { expected: kryptos.algorithm },
      title: "CWT Algorithm Mismatch",
      details:
        "The protected header alg does not match the algorithm of the configured kryptos key.",
    });
  }

  // R2: `CwsKit.verify` takes the ENCODED bytes and strips the outer CWT tag (61)
  // itself; hand it the token verbatim.
  const { payload, header } = new CwsKit({ kryptos, logger }).verify(token);

  // preferMap:false so nested claim objects (act, sub_id, events, custom) decode
  // as plain objects; the top CWT map keeps integer keys so it stays a Map. The
  // codec yields the COSE-name-keyed WIRE (temporal claims as Dates).
  const wire = decodeCwtClaims(
    decodeCbor<Map<unknown, unknown>>(payload, { preferMap: false }),
  );

  // Temporal range (R10) — every temporal claim validated IF PRESENT — plus the
  // caller's wire `assert`, in one pass over the Date-typed wire claims. `now` and
  // the stale-iat bound honour the per-call currentDate/maxTokenAge overrides.
  validate(wire, {
    ...createTemporalMatchers(clockTolerance, options.currentDate, options.maxTokenAge),
    ...(assert ?? {}),
  } as Predicate<Dict>);

  logger.debug("CWT verified");

  return {
    header,
    payload: wire as CwtClaimsWire & C,
    token,
  };
};

/**
 * Decode a CWT to its unified WIRE view WITHOUT verifying — the shared body of
 * `CwtKit.decode`/`CwmKit.decode` (COSE_Sign1 ≡ COSE_Mac0 here). Merges the
 * protected + unprotected COSE header maps into ONE {@link WireTokenHeader}
 * (integer labels translated to their JOSE wire names), and decodes the CBOR
 * claims payload into the COSE-name-keyed WIRE claim map — NO signature/MAC
 * check, NO domain translation. Mirrors `JwtKit.decode`.
 */
export const decodeCwtWire = <C extends Dict = Dict>(
  token: Buffer,
): DecodedStructuredToken<CwtClaimsWire & C> => {
  const cose = unwrapCwt(decodeCbor(token));
  const contents = cose instanceof Tag ? cose.contents : cose;

  if (!Array.isArray(contents) || contents.length < 3) {
    throw new CoseError("Malformed CWT", {
      code: "cose_malformed",
      title: "Malformed CWT",
      details: "The CWT does not contain a recognisable COSE structure.",
    });
  }

  const [protectedBstr, unprotected, payloadBstr, signature] = contents as [
    Uint8Array,
    Map<number, unknown> | undefined,
    Uint8Array | null | undefined,
    Uint8Array | undefined,
  ];

  // A COSE_Sign1/Mac0 may carry a DETACHED (nil) payload — legal COSE, but there
  // are then no claims to decode. Reject it with the clean structural error rather
  // than letting `Buffer.from(null)` throw a raw, confusing TypeError.
  if (payloadBstr == null) {
    throw new CoseError("Malformed CWT", {
      code: "cose_malformed",
      title: "Malformed CWT",
      details: "The CWT has a detached or nil payload, so its claims cannot be decoded.",
    });
  }

  const header = mergeCoseWireHeader(
    decodeProtectedHeader(protectedBstr),
    unprotected instanceof Map ? unprotected : undefined,
    "sig",
  );

  // The payload byte string is the CBOR-encoded claims map; decode it exactly as
  // `verifyCwt` does (preferMap:false so nested claim objects are plain objects).
  const payload = decodeCwtClaims(
    decodeCbor<Map<unknown, unknown>>(Buffer.from(payloadBstr), { preferMap: false }),
  );

  return {
    header,
    payload: payload as CwtClaimsWire & C,
    signature: signature ? Buffer.from(signature) : Buffer.alloc(0),
    token,
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
    throw new CoseError("Malformed CWT", {
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
