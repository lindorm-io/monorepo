import type { Condition } from "@lindorm/match";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { SignatureKit } from "../../classes/SignatureKit.js";
import { CwsError } from "../../errors/index.js";
import { assertAlgorithmMatch } from "../utils/assert-algorithm-match.js";
import { assertWireTyp } from "../utils/assert-wire-typ.js";
import { buildMediaType } from "../utils/compute-typ-header.js";
import { createTemporalMatchers } from "../utils/jwt-temporal-matchers.js";
import { rejectUnknownCritical } from "../utils/reject-unknown-critical.js";
import { validate } from "../utils/validate.js";
import type {
  CwtClaimsWire,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
import { decodeCwt } from "./decode-cwt.js";
import { decodeCwtMessage } from "./cwt-message.js";
import { type CwtFormat, claimsStructureTag } from "./cwt-format.js";
import { ERROR_BY_FORMAT } from "./error-by-format.js";
import { requireAttachedPayload } from "./require-attached-payload.js";
import { requireSignature } from "./require-signature.js";
import { splitSigned } from "./split-signed.js";
import { COSE_TAG, buildSecuredStructure } from "./structures.js";

/**
 * WIRE verify: kid fail-fast + typ well-formedness + typ match (off the cheap
 * header decode), then the structural gates and the signature/MAC over the
 * structure the key's `algClass` implies, then the temporal range (R10, validated
 * IF PRESENT) and the caller `assert`, in one pass over the WIRE claims. Returns
 * the native WIRE payload; NO named matchers, NO exp presence, NO domain
 * translation — those are the Aegis verify path's job.
 *
 * The read twin of `signCwt`, differing in the same three places and no others.
 */
export const verifyCwt = <C extends Dict = Dict>(
  kryptos: IKryptos,
  logger: ILogger,
  params: {
    format: CwtFormat;
    token: Buffer;
    assert?: Condition<CwtClaimsWire & C>;
    clockTolerance: number;
    options: VerifyStructuredTokenOptions;
  },
): VerifiedStructuredToken<CwtClaimsWire & C, Buffer> => {
  const { format, token, assert, clockTolerance, options } = params;

  logger.debug("Verifying CWT", { options });

  const decoded = decodeCwt(token);

  // kid fail-fast: a token naming a kid different from the configured key cannot
  // verify, so reject it before the (expensive) signature cycle. Via Aegis the
  // handed key already matches; this protects the standalone case.
  if (decoded.kid && kryptos.id && decoded.kid !== kryptos.id) {
    throw new ERROR_BY_FORMAT[format]("Invalid token", {
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
  assertWireTyp({
    typ,
    accept: ["application/cwt"],
    suffix: "+cwt",
    presence: "optional",
    error: ERROR_BY_FORMAT[format],
    code: `${format}_invalid_typ`,
    title: "CWT Invalid Typ",
    details:
      "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be verified as a CWT.",
  });

  // typ match: the kit builds the expected media type from the bare PREFIX it
  // re-wraps (the Aegis path derives the prefix from the domain tokenType).
  if (options.tokenType !== undefined) {
    const expected = buildMediaType(options.tokenType, format);
    if (typ !== expected) {
      throw new ERROR_BY_FORMAT[format]("Invalid token", {
        code: `${format}_typ_mismatch`,
        data: { typ },
        debug: { expected },
        title: "CWT Typ Mismatch",
        details: "The header typ does not match the typ expected during verification.",
      });
    }
  }

  // The structure the key implies, and the ONLY one this verify accepts: a
  // COSE_Mac0 handed to an asymmetric key (or a COSE_Sign1 to a symmetric one) is
  // refused as malformed rather than carried into a signature cycle it could
  // never satisfy. `splitSigned` strips the outer CWT tag (61) too, so a token
  // another producer did not envelope reads.
  const tag = claimsStructureTag(kryptos);
  const sign1 = tag === COSE_TAG.sign1;
  const label = sign1 ? "COSE_Sign1" : "COSE_Mac0";

  const {
    protectedBstr,
    payload: securedBstr,
    signature,
    protectedHeader,
    unprotectedHeader,
  } = splitSigned(token, {
    arity: { exactly: 4 },
    tags: [tag],
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `A ${label} must be a 4-element array [protected, unprotected, payload, signature/tag].`,
  });

  // ⛔ The ORDER of the next two is the security property: a hostile header is
  // answered BEFORE the signature cycle, exactly as `JwtKit.verify` answers its
  // identical pair. Both read the PROTECTED bucket alone — the only one the
  // signature covers, and the only one RFC 9052 §3.1 permits `crit` in.

  // Algorithm-match: a structure whose PROTECTED `alg` names an algorithm other
  // than the resolved key's is refused before the signature cycle, so a mismatch
  // reports what is wrong instead of surfacing as an opaque bad signature.
  assertAlgorithmMatch({
    actual: protectedHeader.alg,
    expected: kryptos.algorithm,
    format,
    error: ERROR_BY_FORMAT[format],
    details:
      "The protected header alg does not match the algorithm of the configured kryptos key.",
  });

  rejectUnknownCritical({
    header: protectedHeader,
    format,
    error: ERROR_BY_FORMAT[format],
  });

  // A DETACHED (nil) payload is legal COSE but is not a claims CWT — there is
  // nothing to authenticate and nothing to read — so it is refused with the same
  // structural verdict `decodeCwtWire` gives it, under this path's leaf class.
  const content = requireAttachedPayload(securedBstr, {
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `The ${label} has a detached or nil payload, so there are no CWT claims to verify.`,
  });

  // The twin of the payload check on the other nil-able slot: `exactly: 4` counts
  // ELEMENTS, so a structure with `null` in slot 4 clears the arity, algorithm and
  // crit gates intact. Refused with the same structural verdict rather than
  // letting `Buffer.from(null)` throw a raw TypeError out of the error contract.
  const secured = requireSignature(signature, {
    error: CwsError,
    message: `Malformed ${label}`,
    title: `Malformed ${label}`,
    details: `The ${label} has a nil ${sign1 ? "signature" : "authentication tag"}, so there is nothing to verify.`,
  });

  const valid = new SignatureKit({ kryptos, raw: sign1 }).verify(
    buildSecuredStructure(tag, Buffer.from(protectedBstr), content),
    secured,
  );

  if (!valid) {
    throw sign1
      ? new CwsError("Invalid COSE_Sign1 signature", {
          code: "cose_signature_invalid",
          title: "Invalid COSE Signature",
          details: "The COSE_Sign1 signature did not verify against the resolved key.",
        })
      : new CwsError("Invalid COSE_Mac0 tag", {
          code: "cose_mac_invalid",
          title: "Invalid COSE MAC",
          details:
            "The COSE_Mac0 authentication tag did not verify against the resolved key.",
        });
  }

  // The verified payload IS the CWT Claims Set, read through the ONE Message
  // codec every COSE claims wire shares (`decodeCwtMessage` — RFC 8392 §7.1
  // step 2 / §7.2 step 7, which is also where the no-cty-driven-parse reasoning
  // lives). The codec yields the COSE-name-keyed WIRE (temporal claims as Dates).
  const wire = decodeCwtMessage(content);

  // Temporal range (R10) — every temporal claim validated IF PRESENT — plus the
  // caller's wire `assert`, in one pass over the Date-typed wire claims. `now` and
  // the stale-iat bound honour the per-call currentDate/maxTokenAge overrides.
  validate(
    wire,
    {
      ...createTemporalMatchers({
        clockTolerance,
        currentDate: options.currentDate,
        maxTokenAge: options.maxTokenAge,
        verifyExpiration: options.verifyExpiration,
        verifyNotBefore: options.verifyNotBefore,
        verifyIssuedAt: options.verifyIssuedAt,
        verifyAuthTime: options.verifyAuthTime,
      }),
      ...(assert ?? {}),
    } as Condition<Dict>,
    // The claims kits are PURE WIRE, so a failure here is a kit failure under
    // the kit's own wire-spelled code — never the domain's neutral one.
    ERROR_BY_FORMAT[format],
    `${format}_claims_invalid`,
  );

  logger.debug("CWT verified");

  return {
    protectedHeader,
    unprotectedHeader,
    payload: wire as CwtClaimsWire & C,
    token,
  };
};
