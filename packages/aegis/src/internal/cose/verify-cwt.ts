import type { Condition } from "@lindorm/match";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { assertKidMatch } from "../utils/assert-kid-match.js";
import { assertTokenTypeMatch } from "../utils/assert-token-type-match.js";
import { assertWireTyp } from "../utils/assert-wire-typ.js";
import { validateWireClaims } from "../utils/validate-wire-claims.js";
import { verifyCertBinding } from "../utils/verify-cert-binding.js";
import type {
  CertificateBindingMode,
  CwtClaimsWire,
  CoseVerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
import { decodeCwt } from "./decode-cwt.js";
import { decodeCwtMessage } from "./cwt-message.js";
import type { CwtFormat } from "./cwt-format.js";
import { ERROR_BY_FORMAT } from "./error-by-format.js";
import { resolveWideCertBinding } from "./cose-wide-cert-binding.js";
import { verifyCoseStructure } from "./verify-cose-structure.js";

/**
 * WIRE verify: kid fail-fast, typ well-formedness and typ match off the cheap
 * header decode; then the structural gates and the signature/MAC over the
 * structure the key's `algClass` implies; then the temporal range (validated IF
 * PRESENT) and the caller `assert`, in one pass over the WIRE claims.
 *
 * ⚠ It returns the native WIRE payload. No named matchers, no exp presence, no
 * domain translation — those belong to the Aegis verify path.
 */
export const verifyCwt = <C extends Dict = Dict>(
  kryptos: IKryptos,
  logger: ILogger,
  params: {
    format: CwtFormat;
    token: Buffer;
    assert?: Condition<CwtClaimsWire & C>;
    clockTolerance: number;
    /** The kit's resolved cert-binding mode — the per-call option has already won. */
    certBindingMode: CertificateBindingMode;
    options: VerifyStructuredTokenOptions;
  },
): CoseVerifiedStructuredToken<CwtClaimsWire & C> => {
  const { format, token, assert, clockTolerance, certBindingMode, options } = params;

  logger.debug("Verifying CWT", { options });

  const decoded = decodeCwt(token);

  // kid fail-fast, before the expensive signature cycle. The JOSE claims kit runs
  // the same one; the OPAQUE and ENCRYPTED doors run none.
  assertKidMatch({
    actual: decoded.kid,
    expected: kryptos.id,
    format,
    error: ERROR_BY_FORMAT[format],
  });

  // typ well-formedness: a PRESENT typ must be `application/cwt` or a structured
  // `<type>+cwt`, so a COSE object of another shape cannot pass as a claims CWT.
  // A typ-LESS token is accepted — presence is a DOMAIN/profile policy.
  const typ = decoded.typ;
  assertWireTyp({
    typ,
    accept: ["application/cwt"],
    suffix: "+cwt",
    presence: "optional",
    error: ERROR_BY_FORMAT[format],
    code: `${format}_invalid_typ`,
    // Derived, like every other refusal on this path: a COSE_Mac0 reports itself
    // as a CWM. A hardcoded `CWT` here makes one `cwm` read answer under two
    // spellings depending on which gate fired.
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

  // ⛔ ONE OPENING, shared with the opaque `CwsKit.verify`: the structure the key
  // implies is the ONLY one accepted, so a COSE_Mac0 handed to an asymmetric key
  // is refused as malformed rather than carried into a signature cycle it could
  // never satisfy.
  const { protectedHeader, unprotectedHeader, custom, protectedMap, content } =
    verifyCoseStructure({
      kryptos,
      token,
      declared: options.crit,
      format,
      payloadDetail: "there are no CWT claims to verify",
    });

  // Content tamper check, AFTER the signature/MAC has been verified with the
  // resolved kryptos, as `JwtKit.verify` does. ⚠ NOT a key selection step — header
  // cert fields stay forbidden as key sources.
  //
  // Off the PROTECTED bucket alone: any holder could rewrite a binding the
  // signature does not cover. Both JOSE-carried digests reach it from ONE COSE
  // label (RFC 9360 §2 `x5t`), dispatched by `internal/cose/cose-cert-hash.ts`.
  //
  // ⚠ A SHA-384/SHA-512 binding has no domain field to travel in, so it is
  // resolved against the RAW protected bucket here and handed down as a verdict.
  verifyCertBinding({
    header: {
      certificateThumbprint: protectedHeader["x5t#S256"],
      certificateThumbprintSha1: protectedHeader.x5t,
    },
    computed: resolveWideCertBinding(protectedMap, kryptos),
    kryptos,
    logger,
    mode: certBindingMode,
  });

  // The verified payload IS the CWT Claims Set, read through the ONE Message codec
  // every COSE claims wire shares (`decodeCwtMessage`, which also carries the
  // no-cty-driven-parse reasoning). It yields the COSE-name-keyed WIRE, temporal
  // claims as Dates.
  const wire = decodeCwtMessage(content);

  // Temporal range — every temporal claim validated IF PRESENT — plus the caller's
  // wire `assert`, in one pass. The CBOR codec already yielded `Date`s, which is
  // why no lift happens here and one does on the JOSE wire.
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
    custom,
    payload: wire as CwtClaimsWire & C,
    token,
  };
};
