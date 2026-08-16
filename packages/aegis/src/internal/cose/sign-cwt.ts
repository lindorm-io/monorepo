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
import type { SignStructuredTokenOptions, WireTokenHeader } from "../../types/index.js";
import { algToCoseLabel } from "./alg-labels.js";
import { assertCoseRegistered } from "./assert-cose-registered.js";
import { Tag, encodeCbor } from "./cbor.js";
import { encodeCwtMessage } from "./cwt-message.js";
import type { CwtFormat } from "./cwt-format.js";
import { signedCoseStructureTag } from "./signed-cose-structure-tag.js";
import { ERROR_BY_FORMAT } from "./error-by-format.js";
import { COSE_TAG, buildSecuredStructure } from "./structures.js";

/**
 * TRANSFORM-FREE sign (R18): serialize the already-wire, COSE-name-keyed `claims`
 * dict into a CWT claims map, secure it with a COSE structure (Sign1/Mac0 chosen
 * by the key's `algClass`), and wrap the result in the CWT tag (61). Injects NO
 * envelope claims, derives no hash, maps no name or case — the Aegis-side
 * `signCose` owns all of that. The normalisation the dict passes through is none
 * of those three: it drops `undefined` and the empty value of a claim the
 * REGISTRY declares carries nothing (`internal/utils/normalise-claims.ts`),
 * resolving each key under its COSE spelling as well as its JOSE one.
 *
 * COSE_Sign1 and COSE_Mac0 differ in exactly three places — the tag, the
 * to-be-secured structure, and which `SignatureKit` mode secures it (Sign1 signs
 * RAW `r‖s`, Mac0 HMACs, which has no encoding to choose). Everything around
 * those three is one path, which is why one body serves both claims kits.
 */
export const signCwt = (
  kryptos: IKryptos,
  logger: ILogger,
  format: CwtFormat,
  claims: Dict,
  options: SignStructuredTokenOptions,
): Buffer => {
  logger.debug("Minting CWT", { options });

  // The CWT Message (RFC 8392 §7.1 step 2) — the SHARED claims byte form, not a
  // private one. The COSE_Sign1 and the COSE_Mac0 write the very same bytes,
  // which is what keeps the two claims wires from drifting apart.
  //
  // The single `proprietary` flag threads to BOTH the claim codec and the alg
  // gate below, which agree on the omitted default (D5): interoperable. The codec
  // emits private-use claims under their JOSE string key (`?? false`), and the
  // alg gate is strict (an omitted flag is falsy, so a private-use alg is
  // refused) — an on-platform token sets `proprietary: true` for both.
  const claimsBstr = encodeCwtMessage(normaliseClaims(claims), options.proprietary);

  // Interop gate (D5): a non-proprietary sign refuses an algorithm with no
  // OFFICIAL COSE-RFC registration so the token stays interoperable. Runs before
  // the Sign1/Mac0 split — it applies to both. Every current kryptos signing
  // algorithm is official (ML-DSA joined via RFC 9964), so this guards only a
  // future private-use algorithm; the enc-side (AES-CBC-HMAC) gate is the
  // reachable twin of this mechanism.
  assertCoseRegistered({
    kind: "alg",
    value: kryptos.algorithm,
    proprietary: options.proprietary,
    error: CwsError,
  });

  const tag = signedCoseStructureTag(kryptos);
  const sign1 = tag === COSE_TAG.sign1;

  logger.debug(sign1 ? "Signing COSE_Sign1" : "MAC'ing COSE_Mac0", { options });

  // `typ` (label 16) is the media type built from the `tokenType` PREFIX in this
  // format's family (`+cwt` for both claims kits — the STRUCTURE is what tells a
  // CWM from a CWT) and lands PROTECTED. `typ` is RESERVED — a caller value for
  // it is REFUSED, not merged, because `typ` is what routes a COSE token. `cty`
  // is not: a caller may declare a NESTED payload, and that value rides through
  // these entries as the ONLY source of label 3 on this wire.
  // ⚠ `proprietary` reaches the HEADER build too, not just the claim codec and
  // the alg gate above: a private-use HEADER label (`oid`) is exactly as
  // uninterpretable to a foreign reader as a private-use claim label, so the
  // interoperable default spells it by its string label on both.
  const { protectedEntries, unprotectedEntries } = buildCoseHeaders({
    reserved: KIT_CAPABILITIES[format].reserved,
    header: options.header as Partial<WireTokenHeader> | undefined,
    unprotected: options.unprotected,
    proprietary: options.proprietary,
    error: ERROR_BY_FORMAT[format],
  });

  // `alg` is derived onto the protected map and `kid` onto the unprotected map
  // (COSE convention: kid is an advisory routing hint, read to resolve the
  // verification key before the signature is checked).
  //
  // NO derived `cty`. RFC 8392 §7.2 reads the Message as "a valid CBOR map; let
  // the CWT Claims Set be this CBOR map" — there is no cty-driven decode on this
  // wire, and Appendix A.6 uses `cty` to mark NESTING ("multiple layers of COSE
  // protection before finding the CWT Claims Set"). Deriving one described the
  // ALREADY-CBOR byte string as `application/octet-stream`, which stated nothing
  // true and diverged from the JOSE twin for no reason but the encoding.
  //
  // ⚠ This call also RUNS the `crit` satisfaction check, on the finished protected
  // bucket: `typ` (and, on the wires that derive one, `cty`) are written here, so
  // a `crit` naming one of them is satisfied by this map and not by the caller's
  // entries above.
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

  // Always emit the CWT tag (61) around the structure; verify accepts tagged or
  // untagged.
  return encodeCbor(
    new Tag(
      COSE_TAG.cwt,
      new Tag(tag, [protectedHeader, unprotected, claimsBstr, secured]),
    ),
  );
};
