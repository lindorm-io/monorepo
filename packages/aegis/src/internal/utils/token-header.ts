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
import type { CoseLabel } from "../cose/cose-label.js";
import { canonicalWireHeader } from "../header/canonical-wire-header.js";
import {
  type HeaderCodec,
  type HeaderSpec,
  headerByDomain,
  headerByJose,
  coseWireKey,
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
 *   - {@link shapeWireHeader}      write, `jose -> jose`   (via `headerByJose`)
 *   - {@link parseTokenHeader}     read,  `jose -> domain`  (via `headerByJose`)
 *   - {@link wireHeaderToCoseMap}  write, `jose -> cose label` (via `coseWireKey`)
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
 * Shape a header value for the WIRE: apply the kind's defensive guard and return
 * `undefined` for a missing or wrongly-typed value (dropped by both write passes).
 * Buffer fields (iv/p2s/tag) pass through as Buffers; `encodeJoseHeader`
 * base64url-encodes them.
 *
 * It takes the VALUE, not the source bag, because the two write passes read the
 * value under different keys — `mapTokenHeader` under the domain name,
 * {@link shapeWireHeader} under the JOSE one — while the guard they apply must be
 * the same one, from the same registry row.
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
 *
 * The output is canonically ordered ({@link canonicalWireHeader}) — this pass is
 * the domain tier's whole crossing, so what it returns is a finished bag.
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

  return omitUndefined(canonicalWireHeader(raw)) as WireTokenHeaderOptions;
};

/**
 * The WIRE-KEYED write pass: a JOSE-named bag in, the same bag SHAPED out. It
 * translates nothing — the names are already the wire's — it applies the registry
 * row each parameter carries: the closed-set drop for an unregistered key, and the
 * `HeaderCodec` guard for a value of the wrong shape.
 *
 * This is what lets the JOSE kits stay in wire vocabulary end to end. They used to
 * translate the caller's already-wire bag BACK to domain names (`domain -> wire ->
 * domain -> wire`) purely to reach these guards, which put a second crossing point
 * next to the one `domain-header-to-wire.ts` claims to be.
 *
 * ⚠ Key order is NOT canonicalised here: a shaped bag is a MERGE INPUT
 * ({@link buildJoseHeader}), and only the finished header is sorted.
 *
 * `crit` is shaped by the same {@link criticalToWire} the domain pass uses, which
 * is sort-only on this side: a wire-named member misses `headerByDomain` (every
 * domain name that differs from its wire name is camelCase, and the two that do
 * not differ — `jwk`, `zip` — map to themselves), so no member is rewritten.
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

  return raw as WireTokenHeaderOptions;
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
 * Translate `crit`'s members from JOSE wire NAMES to the COSE LABELS the
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
 * ⚠ That is also why the members take {@link coseWireKey} and the SAME
 * `proprietary` mode the parameters do, rather than the integer label: under the
 * interoperable default `oid` sits at the tstr `"oid"`, so a crit naming the
 * integer `-70000` would recreate the very fatal error above — one spelling in
 * the bucket, another in the list that says the bucket must contain it.
 *
 * A member is refused the same way its parameter is: a parameter COSE cannot
 * carry cannot be marked critical on the COSE wire, because there is no label to
 * name it by.
 */
const critToCoseLabels = (value: unknown, proprietary: boolean | undefined): unknown => {
  if (!Array.isArray(value)) return value;

  return value.map((member) =>
    isString(member) ? coseWireKey(member, proprietary) : member,
  );
};

/**
 * The COSE write pass: a caller's WIRE-named partial header bag -> a COSE label
 * map, each wire name resolved through the registry by {@link coseWireKey} (which
 * THROWS for a parameter COSE does not carry). Undefined values are skipped.
 *
 * ⚠ `proprietary` is the INTEROP MODE, and it decides the KEY, never the
 * parameter set: with the default (falsy) a private-use parameter is written
 * under its string label so a foreign reader can interpret it, with `true` under
 * its compact private-use integer. Nothing is added or dropped either way — see
 * `header-registry.ts#coseWireKey`.
 *
 * The inverse of `coseWireHeader`'s read direction, and — per the file docstring
 * — value-PASSTHROUGH except for `crit`, whose MEMBERS are labels in their own
 * right and are translated by {@link critToCoseLabels}.
 */
export const wireHeaderToCoseMap = (
  bag: Partial<WireTokenHeader> | undefined,
  proprietary: boolean | undefined,
): Map<CoseLabel, unknown> => {
  const map = new Map<CoseLabel, unknown>();

  if (!bag) return map;

  for (const [jose, value] of Object.entries(bag)) {
    if (value === undefined) continue;

    // ⚠ An UNREGISTERED wire key is NOT dropped here, unlike the two JOSE passes:
    // `coseWireKey` refuses it with `header_no_cose_label`. A caller naming a
    // parameter COSE cannot carry must hear so, not watch it vanish — this is the
    // one place the closed-set rule refuses instead of drops. That is also why
    // there is no registry lookup first: a registered parameter and an
    // unregistered one take the SAME call.
    map.set(
      coseWireKey(jose, proprietary),
      jose === "crit" ? critToCoseLabels(value, proprietary) : value,
    );
  }

  return map;
};
