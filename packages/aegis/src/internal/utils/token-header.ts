import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { JoseError } from "../../errors/index.js";
import { normaliseHeaders } from "../header/normalise-headers.js";
import type {
  CertificateHeaderFields,
  WireTokenHeader,
  DomainTokenHeader,
  WireTokenHeaderOptions,
  DomainTokenHeaderOptions,
} from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { canonicalWireHeader } from "../header/canonical-wire-header.js";
import { criticalToWire } from "../header/critical-to-wire.js";
import {
  type HeaderCodec,
  type HeaderSpec,
  coseHeaderCodec,
  headerByDomain,
  headerByJose,
  coseWireKey,
  headerJoseName,
} from "../header/header-registry.js";
import { encodeCoseCertHash } from "../cose/cose-cert-hash.js";
import { encodeCoseX509 } from "../cose/cose-x509.js";
import type { CoseHeaderCodec } from "../registry/cose-header-codec.js";
import { getBaseFormat } from "./compute-typ-header.js";

/**
 * The header translator: the one place a header parameter's name is translated,
 * in any direction, on either wire, driven by `HEADER_SPECS`. An unregistered
 * parameter never crosses these passes — it rides `custom` instead
 * (`internal/header/build-custom-header.ts`).
 *
 * ⚠ A parameter whose COSE form is a STRUCTURE rather than the JOSE value is
 * declared in the registry's `cose` codec cell ({@link CoseHeaderCodec}), never
 * in a list beside these passes.
 */

// --- `crit` member remap ---------------------------------------------------

// The domain -> wire direction lives in `header/critical-to-wire.ts`: sharing that
// one vocabulary is what lets `assert-crit-satisfied.ts` compare a bucket's `crit`
// members against its keys without mapping either.

/** Remap `crit` members WIRE -> DOMAIN; unregistered members pass through. */
const criticalToDomain = (members: unknown): Array<string> => {
  if (!Array.isArray(members)) return [];
  return members.map((member): string => headerByJose(member)?.domain ?? member).sort();
};

// --- value shaping (registry `HeaderCodec` dispatch) ------------------------

/**
 * Shape a header value for the WIRE: apply the kind's guard, `undefined` for a
 * missing or wrongly-typed value (dropped by both write passes). Buffer fields
 * (iv/p2s/tag) stay Buffers; `encodeJoseHeader` base64url-encodes them.
 *
 * It takes the VALUE, not the bag: `mapTokenHeader` reads it under the domain name
 * and {@link shapeWireHeader} under the JOSE one, but the guard must come from the
 * same registry row.
 */
const encodeHeaderValue = (spec: HeaderSpec, value: unknown): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "critical":
      return criticalToWire(value);
    case "string":
      return isString(value) ? value : undefined;
    case "url":
      return isUrlLike(value) ? value : undefined;
    case "number":
      return isFinite(value) ? value : undefined;
    case "jwk":
      return isObject(value) ? value : undefined;
    case "buffer":
      return value;
    case "array":
      return Array.isArray(value) ? value : undefined;
    default: {
      // The `never` binding is on `codec` so a new HeaderCodec member fails the
      // compile. The reported fact must be the `kind` STRING — stringifying the
      // codec object yields "[object Object]".
      const exhaustive: never = codec;
      throw new JoseError("Unhandled header value kind", {
        code: "token_header_unhandled_value_kind",
        data: {
          jose: headerJoseName(spec),
          domain: spec.domain,
          kind: String((exhaustive as HeaderCodec).kind),
        },
        title: "Token Header Unhandled Value Kind",
        details:
          "The header registry produced a value kind the encoder does not handle; a HeaderSpec codec kind is missing an encode branch.",
      });
    }
  }
};

/** Shape a header value for the DOMAIN header; `crit` members remap wire -> domain. */
const decodeHeaderValue = (spec: HeaderSpec, decoded: Dict): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "critical":
      return criticalToDomain(decoded.crit);
    case "string":
    case "url":
    case "number":
    case "jwk":
    case "buffer":
    case "array":
      return decoded[headerJoseName(spec)];
    default: {
      // See `encodeHeaderValue`: the reported fact must be the string
      // discriminant, not the codec object.
      const exhaustive: never = codec;
      throw new JoseError("Unhandled header value kind", {
        code: "token_header_unhandled_value_kind",
        data: {
          jose: headerJoseName(spec),
          domain: spec.domain,
          kind: String((exhaustive as HeaderCodec).kind),
        },
        title: "Token Header Unhandled Value Kind",
        details:
          "The header registry produced a value kind the parser does not handle; a HeaderSpec codec kind is missing a decode branch.",
      });
    }
  }
};

/**
 * Map domain header options (+ the kit-resolved cert fields) to the raw JOSE wire
 * header. The cert fields (`certificateChain`/`certificateThumbprint`/
 * `certificateThumbprintSha1`) are derived by the kit from the kryptos rather
 * than supplied by a caller, so they are folded into the domain-keyed source (their
 * `CertificateHeaderFields` keys already equal their domain names).
 *
 * ⚠ The {@link normaliseHeaders} call is LOAD-BEARING here, not a repeat of the
 * emission boundary's: it resolves a `contentType: ""` to an absent `cty` before
 * the kit door below reads the bag. A caller reaching a kit door directly
 * (`aegis.jws.sign`, `aegis.cwe.encrypt`, …) never passes through here and
 * normalises its own bag at the door — this pass answers the DOMAIN tier alone.
 *
 * ⚠ It knows nothing about `crit` and needs to know nothing: this pass is a
 * FRAGMENT of a message, and `assert-crit-satisfied.ts` answers that question on
 * the whole header.
 */
export const mapTokenHeader = (
  options: DomainTokenHeaderOptions,
  cert: CertificateHeaderFields = {},
): WireTokenHeaderOptions => {
  const source: Dict = {
    ...options,
    certificateChain: cert.certificateChain,
    certificateThumbprint: cert.certificateThumbprint,
    certificateThumbprintSha1: cert.certificateThumbprintSha1,
  };

  // Single pass over the domain-keyed source; an unregistered key is dropped
  // (headers are a closed set), and so is a value the registry's guard rejects.
  const raw: Dict = {};
  for (const key of Object.keys(source)) {
    const spec = headerByDomain(key);
    if (!spec) continue;

    const encoded = encodeHeaderValue(spec, source[key]);
    if (encoded !== undefined) raw[headerJoseName(spec)] = encoded;
  }

  return normaliseHeaders(canonicalWireHeader(raw)) as WireTokenHeaderOptions;
};

/**
 * The WIRE-KEYED write pass: a JOSE-named bag in, the same bag SHAPED out. It
 * translates nothing — it applies the registry row each parameter carries: the
 * closed-set drop for an unregistered key, and the `HeaderCodec` guard for a value
 * of the wrong shape. This is what lets the JOSE kits stay in wire vocabulary end
 * to end.
 *
 * ⚠ Key order is NOT canonicalised here: a shaped bag is a MERGE INPUT
 * ({@link buildJoseHeader}), and only the finished header is sorted. Empty values
 * ARE removed ({@link normaliseHeaders}), so the merge cannot reintroduce one.
 *
 * ⚠ A merge input is a FRAGMENT of a message: whether another tier's `crit` still
 * names a value this one emits nothing for is answered once by
 * {@link buildJoseHeader} (`assert-crit-satisfied.ts`), as a REFUSAL.
 *
 * `crit` takes the same {@link criticalToWire} the domain pass uses, sort-only on
 * this side: a wire-named member misses `headerByDomain`, so no member is
 * rewritten.
 */
export const shapeWireHeader = (
  bag: Partial<WireTokenHeaderOptions> | undefined,
): WireTokenHeaderOptions => {
  const raw: Dict = {};

  if (!bag) return raw as WireTokenHeaderOptions;

  for (const key of Object.keys(bag)) {
    const spec = headerByJose(key);
    if (!spec) continue;

    const encoded = encodeHeaderValue(spec, (bag as Dict)[key]);
    if (encoded !== undefined) raw[headerJoseName(spec)] = encoded;
  }

  return normaliseHeaders(raw) as WireTokenHeaderOptions;
};

/**
 * The READ pass: a decoded wire header -> the domain header. An unregistered wire
 * key is dropped (the closed-set rule), and `crit`'s members are remapped wire ->
 * domain.
 *
 * ⚠ IT DOES NOT NORMALISE — the `omitUndefined` below is not the twin of the write
 * passes' {@link normaliseHeaders}; do not "restore the symmetry". A read-side
 * prune would delete the `critical = []` default set below (non-optional on
 * `DomainTokenHeader`), would report a foreign token's `cty: ""` as absent, and
 * would delete the evidence `validate-crit.ts`, `JweKit.decrypt` and
 * `verify-cert-binding.ts` refuse on.
 *
 * The `omitUndefined` does a DIFFERENT job: it makes `baseFormat` ABSENT rather
 * than present-with-`undefined` when `typ` names no recognised format.
 */
export const parseTokenHeader = <T extends DomainTokenHeader = DomainTokenHeader>(
  decoded: WireTokenHeader,
): T => {
  // Single pass over the decoded wire claims; an unregistered wire key is dropped.
  const result: Dict = {};
  for (const key of Object.keys(decoded)) {
    const spec = headerByJose(key);
    if (!spec) continue;

    result[spec.domain] = decodeHeaderValue(spec, decoded as Dict);
  }

  // `critical` is always present in the domain header (an absent `crit` maps to
  // `[]`), so default it after the pass — the loop only sets it when `crit` is on
  // the wire.
  if (result.critical === undefined) result.critical = [];

  // `baseFormat` is DERIVED from `typ` (not a wire parameter of its own), so it
  // is set outside the registry pass. Kits may override it after parsing.
  result.baseFormat = getBaseFormat(decoded.typ);

  return omitUndefined(result) as T;
};

/**
 * Translate `crit`'s members from JOSE wire NAMES to the COSE LABELS the
 * parameters are keyed under. RFC 9052 §1.5, RFC 9052 §3.1.
 *
 * ⚠ The members take {@link coseWireKey} with the SAME `proprietary` mode as the
 * parameters, never the integer label directly: otherwise the bucket and the crit
 * list naming it spell the same parameter differently.
 *
 * ⚠ AN UNREGISTERED MEMBER IS ITS OWN TSTR LABEL, not a refusal.
 * `assert-crit-eligible.ts` has already refused every member that is neither
 * registry-eligible nor a key of the same call's `custom.protected` bag, so an
 * unregistered member here IS a custom parameter that `build-cose-headers.ts`
 * writes under exactly that tstr label. {@link coseWireKey} would throw
 * `header_no_cose_label` for it.
 */
const critToCoseLabels = (value: unknown, proprietary: boolean | undefined): unknown => {
  if (!Array.isArray(value)) return value;

  return value.map((member) => {
    if (!isString(member)) return member;

    return headerByJose(member) === undefined ? member : coseWireKey(member, proprietary);
  });
};

/**
 * Shape ONE header value for the COSE wire, dispatched on the registry's `cose`
 * codec cell. The write half of the per-wire codec; `coseValueToWire` in
 * `header/cose-wire-header.ts` is the read half.
 *
 * ⚠ `alg`, `kid` and `iv` PASS THROUGH UNCHANGED: they are written onto their
 * buckets by `mergeCoseProtected`/`mergeCoseUnprotected`, so one reaching here came
 * from a CALLER's bag and `buildCoseHeaders` refuses it by name
 * (`cose_reserved_header`) one step later. Transforming the value first would
 * replace that refusal.
 */
const encodeCoseHeaderValue = (
  jose: string,
  value: unknown,
  proprietary: boolean | undefined,
): unknown => {
  const codec: CoseHeaderCodec = coseHeaderCodec(jose);

  switch (codec.kind) {
    case "critical":
      return critToCoseLabels(value, proprietary);
    case "certChain":
      return encodeCoseX509(value);
    case "certHash":
      return encodeCoseCertHash(value);
    case "algorithmLabel":
    case "textBytes":
    case "base64Bytes":
    case "passthrough":
      return value;
    default: {
      // See `encodeHeaderValue`: the reported fact is the string discriminant.
      const exhaustive: never = codec;
      throw new JoseError("Unhandled COSE header value kind", {
        code: "token_header_unhandled_cose_value_kind",
        data: { jose, kind: String((exhaustive as CoseHeaderCodec).kind) },
        title: "Token Header Unhandled COSE Value Kind",
        details:
          "The header registry produced a COSE value kind the encoder does not handle; a HeaderSpec cose codec kind is missing an encode branch.",
      });
    }
  }
};

/**
 * The COSE write pass: a caller's WIRE-named partial header bag -> a COSE label
 * map, each wire name resolved by {@link coseWireKey} (which THROWS for a
 * parameter COSE does not carry). The inverse of `coseWireHeader`'s read
 * direction.
 *
 * The bag is NORMALISED on entry ({@link normaliseHeaders}), which disposes of a
 * value that emits nothing: an `undefined`, and the empty value of a parameter the
 * registry says prunes.
 *
 * ⚠ `proprietary` decides the KEY, never the parameter set: falsy writes a
 * private-use parameter under its string label, `true` under its compact
 * private-use integer. See `header-registry.ts#coseWireKey`.
 *
 * ⚠ A bag here is a BUCKET of a COSE message, not the message: whether the
 * protected bucket's `crit` still names a value this bucket emits nothing for is
 * answered once by `buildCoseHeaders` (`assert-crit-satisfied.ts`), as a REFUSAL.
 */
export const wireHeaderToCoseMap = (
  bag: Partial<WireTokenHeader> | undefined,
  proprietary: boolean | undefined,
): Map<CoseLabel, unknown> => {
  const map = new Map<CoseLabel, unknown>();

  if (!bag) return map;

  for (const [jose, value] of Object.entries(normaliseHeaders(bag as Dict))) {
    // ⚠ An UNREGISTERED wire key is NOT dropped here, unlike the two JOSE passes:
    // `coseWireKey` refuses it with `header_no_cose_label`, so a caller naming a
    // parameter COSE cannot carry hears about it. Hence no registry lookup first —
    // registered and unregistered take the same call.
    const label = coseWireKey(jose, proprietary);

    map.set(label, encodeCoseHeaderValue(jose, value, proprietary));
  }

  return map;
};
