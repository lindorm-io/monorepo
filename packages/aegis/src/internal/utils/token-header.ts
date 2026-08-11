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
  headerJoseName,
} from "../header/header-registry.js";
import { getBaseFormat } from "./compute-typ-header.js";

/**
 * The header translator (the header-side twin of `claims/translate.ts`): the ONE
 * place the JOSE wire<->domain header NAME map is applied, driven entirely by
 * `HEADER_REGISTRY`. Both directions are a single DATA-DRIVEN pass — over the
 * actual header data, not a curated subset: {@link mapTokenHeader} (write,
 * `domain -> jose`) iterates the domain-keyed source and looks each key up via
 * `headerByDomain`; {@link parseTokenHeader} (read, `jose -> domain`) iterates the
 * decoded wire claims and looks each key up via `headerByJose`. Unlike custom
 * claims, headers are a CLOSED set: a key with no registry entry is dropped (no
 * passthrough) — the registry states that once, as `unregistered: "drop"`. The
 * registry's `HeaderCodec` drives the value shaping below.
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
