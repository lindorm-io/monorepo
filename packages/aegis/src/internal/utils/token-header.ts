import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { JoseError } from "../../errors/index.js";
import type {
  CertificateHeaderFields,
  WireTokenHeader,
  DomainTokenHeader,
  WireTokenHeaderOptions,
  DomainTokenHeaderOptions,
} from "../../types/index.js";
import {
  type HeaderCodec,
  type HeaderSpec,
  headerByDomain,
  headerByJose,
  coseByJose,
  headerJoseName,
} from "../header/header-registry.js";
import { getBaseFormat } from "./compute-typ-header.js";

/**
 * The header translator (the header-side twin of `claims/translate.ts`): the ONE
 * place a header parameter's name is translated, in ANY direction, on EITHER
 * wire, driven entirely by `HEADER_REGISTRY`. Every pass is DATA-DRIVEN — it
 * iterates the actual header data, not a curated subset, and looks each key up in
 * the registry:
 *
 *   - {@link mapTokenHeader}       write, `domain -> jose`  (via `headerByDomain`)
 *   - {@link parseTokenHeader}     read,  `jose -> domain`  (via `headerByJose`)
 *   - {@link wireHeaderToCoseMap}  write, `jose -> cose label` (via `coseByJose`)
 *
 * Unlike custom claims, headers are a CLOSED set: a key with no registry entry is
 * dropped (no passthrough) — the registry states that once, as
 * `unregistered: "drop"`. The registry's `HeaderCodec` drives the value shaping.
 *
 * ⚠ The COSE pass is value-PASSTHROUGH for every parameter but ONE: the
 * caller-settable COSE params (`typ`/`cty`/`x5c`/`x5u`) already carry the wire
 * representation that round-trips back on read, so shaping them here would only
 * change the bytes. `crit` is the exception, and has to be — see
 * {@link critToCoseLabels}.
 */

// --- `crit` member remap (the one member-transforming parameter) ------------

/** Remap `crit` members DOMAIN -> WIRE; unregistered members pass through. */
const criticalToWire = (members: unknown): Array<string> | undefined => {
  if (!Array.isArray(members)) return undefined;
  return members
    .map((member): string => {
      const spec = headerByDomain(member);
      return spec ? headerJoseName(spec) : member;
    })
    .sort();
};

/** Remap `crit` members WIRE -> DOMAIN; unregistered members pass through. */
const criticalToDomain = (members: unknown): Array<string> => {
  if (!Array.isArray(members)) return [];
  return members.map((member): string => headerByJose(member)?.domain ?? member).sort();
};

// --- value shaping (registry `HeaderCodec` dispatch) ------------------------

/**
 * Shape a header value for the WIRE: read it from the domain-keyed source, apply
 * the kind's defensive guard, and return `undefined` for a missing or
 * wrongly-typed value (dropped downstream by `omitUndefined`). Buffer fields
 * (iv/p2s/tag) pass through as Buffers; `encodeJoseHeader` base64url-encodes them.
 */
const encodeHeaderValue = (spec: HeaderSpec, source: Dict): unknown => {
  const value = source[spec.domain];
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
      // The `never` binding is on `codec` — that is what makes the compiler bite
      // on a new HeaderCodec member. The REPORTED fact must be the `kind` STRING:
      // stringifying the codec OBJECT yields "[object Object]" and loses the one
      // fact this handler exists to name.
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

/**
 * Shape a header value for the DOMAIN header: the parser copies the wire value
 * verbatim, except `crit`, whose members are remapped wire -> domain.
 */
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
      // See `encodeHeaderValue`: the `never` binding is the compiler backstop,
      // but the REPORTED fact must be the string discriminant — `String(codec)`
      // on the codec object reads "[object Object]".
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
 * `certificateThumbprintSha1`) are `provenance: "key"` params the kit derives from
 * the kryptos, so they are folded into the domain-keyed source (their
 * `CertificateHeaderFields` keys already equal their domain names).
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
  // (headers are a closed set). Collect emitted `[jose, value]` pairs, then sort
  // by jose so the on-wire JSON key order stays canonically alphabetical — the
  // signed-header bytes depend on it (see `encodeJoseHeader`).
  const emitted: Array<[string, unknown]> = [];
  for (const key of Object.keys(source)) {
    const spec = headerByDomain(key);
    if (!spec) continue;

    const encoded = encodeHeaderValue(spec, source);
    if (encoded !== undefined) emitted.push([headerJoseName(spec), encoded]);
  }
  emitted.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const raw: Dict = {};
  for (const [jose, value] of emitted) {
    raw[jose] = value;
  }

  return omitUndefined(raw) as WireTokenHeaderOptions;
};

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
  // the wire. This preserves the pre-refactor `criticalToDomain(undefined) -> []`.
  if (result.critical === undefined) result.critical = [];

  // `baseFormat` is DERIVED from `typ` (not a wire parameter of its own), so it
  // is set outside the registry pass. Kits may override it after parsing.
  result.baseFormat = getBaseFormat(decoded.typ);

  return omitUndefined(result) as T;
};

/**
 * Translate `crit`'s members from JOSE wire NAMES to the COSE integer LABELS the
 * parameters are actually keyed under.
 *
 * RFC 9052 §1.5 defines `label = int / tstr`, so the tstr `"oid"` and the int
 * `-70000` the lindorm `oid` parameter rides under are DIFFERENT labels. RFC 9052
 * §3.1: *"if the crit value list includes a label for which the header parameter
 * is not in the protected-header-parameters bucket, this is a fatal error in
 * processing the message."* Emitting the NAME while keying the parameter by its
 * LABEL therefore produced a token that was fatally malformed by its own
 * `crit` — which is exactly what this pass did until 2026-08-11.
 *
 * So a crit member is translated through the SAME `coseByJose` its parameter is,
 * and refused the same way: a parameter COSE cannot carry cannot be marked
 * critical on the COSE wire, because there is no label to name it by.
 */
const critToCoseLabels = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;

  return value.map((member) => (isString(member) ? coseByJose(member) : member));
};

/**
 * The COSE write pass: a caller's WIRE-named partial header bag -> a COSE
 * integer-label map, each wire name resolved through the registry by
 * {@link coseByJose} (which THROWS for a parameter COSE has no integer label).
 * Undefined values are skipped.
 *
 * The inverse of `coseWireHeader`'s read direction, and — per the file docstring
 * — value-PASSTHROUGH except for `crit`, whose MEMBERS are labels in their own
 * right and are translated by {@link critToCoseLabels}.
 */
export const wireHeaderToCoseMap = (
  bag: Partial<WireTokenHeader> | undefined,
): Map<number, unknown> => {
  const map = new Map<number, unknown>();

  if (!bag) return map;

  for (const [jose, value] of Object.entries(bag)) {
    if (value === undefined) continue;

    // ⚠ An UNREGISTERED wire key is NOT dropped here, unlike the two JOSE passes:
    // `coseByJose` refuses it with `header_no_cose_label`. A caller naming a
    // parameter COSE cannot carry must hear so, not watch it vanish — this is the
    // one place the closed-set rule refuses instead of drops. That is also why
    // there is no registry lookup first: a registered parameter and an
    // unregistered one take the SAME call, which is the only one that can type
    // the map key as the `number` the map declares.
    map.set(coseByJose(jose), jose === "crit" ? critToCoseLabels(value) : value);
  }

  return map;
};
