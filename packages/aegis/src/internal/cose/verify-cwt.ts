import type { Condition } from "@lindorm/match";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { assertKidMatch } from "../utils/assert-kid-match.js";
import { assertTokenTypeMatch } from "../utils/assert-token-type-match.js";
import { assertWireTyp } from "../utils/assert-wire-typ.js";
import { validateWireClaims } from "../utils/validate-wire-claims.js";
import type {
  CwtClaimsWire,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
import { decodeCwt } from "./decode-cwt.js";
import { decodeCwtMessage } from "./cwt-message.js";
import type { CwtFormat } from "./cwt-format.js";
import { ERROR_BY_FORMAT } from "./error-by-format.js";
import { verifyCoseStructure } from "./verify-cose-structure.js";

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

  // kid fail-fast, before the (expensive) signature cycle. The JOSE claims kit
  // runs the same one; the OPAQUE and ENCRYPTED doors deliberately run none.
  assertKidMatch({
    actual: decoded.kid,
    expected: kryptos.id,
    format,
    error: ERROR_BY_FORMAT[format],
  });

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
    // Derived, like the code beside it and like every other refusal on this
    // path: a COSE_Mac0 reports itself as a CWM. This was the last hardcoded
    // `CWT` left after the kid/typ-mismatch titles started deriving, so a `cwm`
    // read answered under two different spellings depending on which gate fired.
    title: `${format.toUpperCase()} Invalid Typ`,
    details:
      "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be verified as a CWT.",
  });

  // typ match: the kit builds the expected media type from the bare PREFIX it
  // re-wraps (the Aegis path derives the prefix from the domain tokenType).
  assertTokenTypeMatch({
    typ,
    tokenType: options.tokenType,
    format,
    error: ERROR_BY_FORMAT[format],
  });

  // ⛔ ONE OPENING, shared with the opaque `CwsKit.verify`. The structure the key
  // implies is the ONLY one accepted — a COSE_Mac0 handed to an asymmetric key
  // (or a COSE_Sign1 to a symmetric one) is refused as malformed rather than
  // carried into a signature cycle it could never satisfy — the two
  // protected-header gates answer a hostile header before any cryptography, and
  // the signature or MAC is checked over the structure.
  const { protectedHeader, unprotectedHeader, content } = verifyCoseStructure({
    kryptos,
    token,
    format,
    payloadDetail: "there are no CWT claims to verify",
  });

  // The verified payload IS the CWT Claims Set, read through the ONE Message
  // codec every COSE claims wire shares (`decodeCwtMessage` — RFC 8392 §7.1
  // step 2 / §7.2 step 7, which is also where the no-cty-driven-parse reasoning
  // lives). The codec yields the COSE-name-keyed WIRE (temporal claims as Dates).
  const wire = decodeCwtMessage(content);

  // Temporal range (R10) — every temporal claim validated IF PRESENT — plus the
  // caller's wire `assert`, in one pass. The CBOR codec has already yielded
  // `Date`s, which is why no lift happens here and one does on the JOSE wire.
  validateWireClaims({
    claims: wire,
    assert: assert as Condition<Dict> | undefined,
    options,
    clockTolerance,
    format,
    error: ERROR_BY_FORMAT[format],
  });

  logger.debug("CWT verified");

  return {
    protectedHeader,
    unprotectedHeader,
    payload: wire as CwtClaimsWire & C,
    token,
  };
};
