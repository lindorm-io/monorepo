import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { SignatureKit } from "../../classes/SignatureKit.js";
import { CwsError } from "../../errors/index.js";
import { buildCoseHeaders } from "../header/build-cose-headers.js";
import { mergeCoseProtected } from "../header/merge-cose-protected.js";
import { mergeCoseUnprotected } from "../header/merge-cose-unprotected.js";
import { KIT_CAPABILITIES } from "../registry/kit-capabilities.js";
import { normaliseClaims } from "../utils/normalise-claims.js";
import { buildMediaType } from "../utils/compute-typ-header.js";
import { resolveCertBinding } from "../utils/resolve-cert-binding.js";
import { COSE_THUMBPRINT_SHA1 } from "./cose-thumbprint-sha1.js";
import type {
  CoseSignStructuredTokenOptions,
  WireTokenHeader,
} from "../../types/index.js";
import { algToCoseLabel } from "./alg-labels.js";
import { assertCoseRegistered } from "./assert-cose-registered.js";
import { Tag, encodeCbor } from "./cbor.js";
import { encodeCwtMessage } from "./cwt-message.js";
import type { CwtFormat } from "./cwt-format.js";
import { signedCoseStructureTag } from "./signed-cose-structure-tag.js";
import { ERROR_BY_FORMAT } from "./error-by-format.js";
import { COSE_TAG, buildSecuredStructure } from "./structures.js";

/**
 * TRANSFORM-FREE sign: the already-wire, COSE-name-keyed `claims` dict becomes a
 * CWT claims map, secured as Sign1 or Mac0 by the key's `algClass` and wrapped in
 * the CWT tag. It injects no envelope claims, derives no hash and maps no name or
 * case — the Aegis-side `signCose` owns all of that. The one normalisation is
 * `internal/utils/normalise-claims.ts`, which drops `undefined` and the empty
 * value of a claim the REGISTRY declares carries nothing.
 *
 * COSE_Sign1 and COSE_Mac0 differ in the tag, the to-be-secured structure and the
 * `SignatureKit` mode — everything around those three is one path, which is why
 * one body serves both claims kits.
 */
export const signCwt = (
  kryptos: IKryptos,
  logger: ILogger,
  format: CwtFormat,
  claims: Dict,
  options: CoseSignStructuredTokenOptions,
): Buffer => {
  logger.debug("Minting CWT", { options });

  // The CWT Message (RFC 8392 §7.1) — the SHARED claims byte form: Sign1 and Mac0
  // write the very same bytes, so the two claims wires cannot drift apart.
  //
  // ⚠ One `proprietary` flag threads to BOTH the claim codec and the alg gate
  // below, and they agree on the omitted default: interoperable. The codec emits
  // private-use claims under their JOSE string key; the alg gate refuses a
  // private-use alg. An on-platform token sets `proprietary: true` for both.
  const claimsBstr = encodeCwtMessage(normaliseClaims(claims), options.proprietary);

  // Interop gate: a non-proprietary sign refuses an algorithm with no official
  // COSE registration. Before the Sign1/Mac0 split, so it applies to both. Every
  // kryptos signing algorithm is registered, so this guards a future private-use
  // one; the enc-side (AES-CBC-HMAC) gate is the reachable twin.
  assertCoseRegistered({
    kind: "alg",
    value: kryptos.algorithm,
    proprietary: options.proprietary,
    error: CwsError,
  });

  const tag = signedCoseStructureTag(kryptos);
  const sign1 = tag === COSE_TAG.sign1;

  logger.debug(sign1 ? "Signing COSE_Sign1" : "MAC'ing COSE_Mac0", { options });

  // `typ` is built from the `tokenType` prefix (`+cwt` for both claims kits — the
  // STRUCTURE is what tells a CWM from a CWT) and lands PROTECTED. It is RESERVED:
  // a caller value is REFUSED, not merged, because `typ` is what routes a COSE
  // token. `cty` is not — a caller may declare a NESTED payload, and that is the
  // ONLY source of label 3 on this wire.
  //
  // ⚠ `proprietary` reaches the HEADER build too: a private-use header label is as
  // uninterpretable to a foreign reader as a private-use claim label, so the
  // interoperable default spells both by their string label.
  const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
    reserved: KIT_CAPABILITIES[format].reserved,
    header: options.header as Partial<WireTokenHeader> | undefined,
    custom: options.custom,
    cert: resolveCertBinding(kryptos, options.bindCertificate, COSE_THUMBPRINT_SHA1),
    proprietary: options.proprietary,
    format,
    error: ERROR_BY_FORMAT[format],
  });

  // `alg` is derived onto the protected map and `kid` onto the unprotected one
  // (RFC 9052 §3.1 — `kid` is an advisory hint, read to resolve the verification
  // key before the signature is checked).
  //
  // ⚠ NO derived `cty`: there is no cty-driven decode on this wire (RFC 8392 §7.2)
  // and `cty` marks NESTING there, so a derived `application/octet-stream` would
  // state nothing true about the already-CBOR byte string.
  //
  // ⚠ This call also RUNS the `crit` satisfaction check, on the FINISHED protected
  // bucket: `typ` is written here, so a `crit` naming it is satisfied by this map
  // and not by the caller's entries above.
  const protectedHeader = mergeCoseProtected({
    alg: algToCoseLabel(kryptos.algorithm),
    typ: buildMediaType(options.tokenType, format),
    entries: protectedEntries,
    proprietary: options.proprietary,
    format,
    error: ERROR_BY_FORMAT[format],
  });

  const unprotected = mergeCoseUnprotected({
    kid: kryptos.id,
    entries: unprotectedEntries,
    proprietary: options.proprietary,
  });

  const secured = new SignatureKit({ kryptos, raw: sign1 }).sign(
    buildSecuredStructure(tag, protectedHeader, claimsBstr),
  );

  // Always tagged on write; verify accepts tagged or untagged.
  return encodeCbor(
    new Tag(
      COSE_TAG.cwt,
      new Tag(tag, [protectedHeader, unprotected, claimsBstr, secured]),
    ),
  );
};
