import { isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisError } from "../../errors/index.js";
import type {
  CertificateHeaderFields,
  DecodedTokenHeader,
  ParsedTokenHeader,
  RawTokenHeaderClaims,
  TokenHeaderOptions,
} from "../../types/index.js";
import {
  type HeaderSpec,
  headerByDomain,
  headerByWire,
  READ_HEADER_SPECS,
  WRITE_HEADER_SPECS,
} from "../header/header-registry.js";
import { getBaseFormat } from "./compute-typ-header.js";

/**
 * The header translator (the header-side twin of `claims/translate.ts`): the ONE
 * place the JOSE wire<->domain header NAME map is applied, driven entirely by
 * `HEADER_REGISTRY`. Both directions — `domain -> wire` (write, {@link mapTokenHeader})
 * and `wire -> domain` (read, {@link parseTokenHeader}) — are a single pass over
 * the registry; the per-field switches and object literals that used to live here
 * are gone. The registry's `HeaderValueKind` drives the value shaping below.
 */

// --- `crit` member remap (the one member-transforming parameter) ------------

/** Remap `crit` members DOMAIN -> WIRE; unregistered members pass through. */
const criticalToWire = (members: unknown): Array<string> | undefined => {
  if (!Array.isArray(members)) return undefined;
  return members.map((member): string => headerByDomain(member)?.wire ?? member).sort();
};

/** Remap `crit` members WIRE -> DOMAIN; unregistered members pass through. */
const criticalToDomain = (members: unknown): Array<string> => {
  if (!Array.isArray(members)) return [];
  return members.map((member): string => headerByWire(member)?.domain ?? member).sort();
};

// --- value shaping (registry `HeaderValueKind` dispatch) --------------------

/**
 * Shape a header value for the WIRE: read it from the domain-keyed source, apply
 * the kind's defensive guard, and return `undefined` for a missing or
 * wrongly-typed value (dropped downstream by `omitUndefined`). Buffer fields
 * (iv/p2s/tag) pass through as Buffers; `encodeJoseHeader` base64url-encodes them.
 */
const encodeHeaderValue = (spec: HeaderSpec, source: Dict): unknown => {
  const value = source[spec.domain];
  switch (spec.value) {
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
      const exhaustive: never = spec.value;
      throw new AegisError("Unhandled header value kind", {
        code: "token_header_unhandled_value_kind",
        data: { wire: spec.wire, domain: spec.domain, value: String(exhaustive) },
        title: "Token Header Unhandled Value Kind",
        details:
          "The header registry produced a value kind the encoder does not handle; a HeaderSpec value kind is missing an encode branch.",
      });
    }
  }
};

/**
 * Shape a header value for the DOMAIN header: the parser copies the wire value
 * verbatim, except `crit`, whose members are remapped wire -> domain.
 */
const decodeHeaderValue = (spec: HeaderSpec, decoded: Dict): unknown => {
  switch (spec.value) {
    case "critical":
      return criticalToDomain(decoded.crit);
    case "string":
    case "url":
    case "number":
    case "jwk":
    case "buffer":
    case "array":
      return decoded[spec.wire];
    default: {
      const exhaustive: never = spec.value;
      throw new AegisError("Unhandled header value kind", {
        code: "token_header_unhandled_value_kind",
        data: { wire: spec.wire, domain: spec.domain, value: String(exhaustive) },
        title: "Token Header Unhandled Value Kind",
        details:
          "The header registry produced a value kind the parser does not handle; a HeaderSpec value kind is missing a decode branch.",
      });
    }
  }
};

/**
 * Map domain header options (+ the kit-resolved cert fields) to the raw JOSE wire
 * header. The cert fields (`x5c`/`x5t#S256`) are `provenance: "key"` params the
 * kit derives from the kryptos, so they are folded into the domain-keyed source
 * (their `CertificateHeaderFields` keys already equal their domain names).
 */
export const mapTokenHeader = (
  options: TokenHeaderOptions,
  cert: CertificateHeaderFields = {},
): RawTokenHeaderClaims => {
  const source: Dict = { ...options, x5c: cert.x5c, x5tS256: cert.x5tS256 };

  const raw: Dict = {};
  for (const spec of WRITE_HEADER_SPECS) {
    raw[spec.wire] = encodeHeaderValue(spec, source);
  }

  return omitUndefined(raw) as RawTokenHeaderClaims;
};

export const parseTokenHeader = <T extends ParsedTokenHeader = ParsedTokenHeader>(
  decoded: DecodedTokenHeader,
): T => {
  const result: Dict = {};
  for (const spec of READ_HEADER_SPECS) {
    result[spec.domain] = decodeHeaderValue(spec, decoded as Dict);
  }

  // `baseFormat` is DERIVED from `typ` (not a wire parameter of its own), so it
  // is set outside the registry pass. Kits may override it after parsing.
  result.baseFormat = getBaseFormat(decoded.typ);

  return omitUndefined(result) as T;
};
