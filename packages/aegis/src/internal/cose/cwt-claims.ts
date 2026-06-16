import { B64 } from "@lindorm/b64";
import { getUnixTime } from "@lindorm/date";
import { isDate, isFinite } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../constants/format.js";
import {
  type ClaimSpec,
  specByCose,
  specByDomain,
  specByJose,
} from "../claims/registry.js";
import { decodeActCompact, encodeActCompact } from "./act-claim.js";
import { decodeCnf, encodeCnf } from "./cose-key.js";
import { decodeSubIdCompact, encodeSubIdCompact } from "./sub-id-claim.js";

const ACT_DOMAINS = new Set(["act", "mayAct"]);

// OIDC hash claims: b64url string <-> COSE byte string.
const HASH_DOMAINS = new Set(["accessTokenHash", "codeHash", "stateHash"]);

// `confirmation` (cnf) -> a COSE cnf map (RFC 8747, via COSE_Key). The other
// structured claims (act / mayAct / subjectId / events / authorizationDetails)
// pass through: CBOR encodes their nested objects/arrays as maps/arrays, and
// they decode back to objects (the payload is decoded with preferMap:false; the
// top CWT map and cnf/COSE_Key maps have integer keys so they stay Maps).

const encodeValue = (spec: ClaimSpec, value: unknown, proprietary: boolean): unknown => {
  switch (spec.value) {
    case "text":
    case "array":
    case "int":
      return value;
    case "date":
      // NumericDate: domain Date -> Unix-seconds int.
      return isDate(value) ? getUnixTime(value) : value;
    case "bstr":
      // cti: the token id string -> its UTF-8 bytes.
      return Buffer.from(String(value), "utf8");
    case "bespoke":
      if (HASH_DOMAINS.has(spec.domain)) {
        // OIDC hash: base64url string -> raw bytes (COSE bstr).
        return B64.toBuffer(String(value), B64U);
      }
      if (spec.domain === "confirmation")
        return encodeCnf(value as Record<string, unknown>);
      if (ACT_DOMAINS.has(spec.domain)) {
        // Compact integer-keyed act when proprietary encoding is allowed
        // (default); the interoperable string-keyed object otherwise.
        return proprietary ? encodeActCompact(value as Dict) : value;
      }
      if (spec.domain === "subjectId") {
        return proprietary ? encodeSubIdCompact(value as Dict) : value;
      }
      return value; // events / authorizationDetails (dynamic keys; string-keyed)
  }
};

const decodeValue = (spec: ClaimSpec, value: unknown): unknown => {
  switch (spec.value) {
    case "text":
    case "array":
    case "int":
      return value;
    case "date":
      // Unix seconds -> domain Date (matches the JOSE parse shape).
      return isFinite(value) ? new Date(value * 1000) : value;
    case "bstr":
      return Buffer.from(value as Uint8Array).toString("utf8");
    case "bespoke":
      if (HASH_DOMAINS.has(spec.domain)) {
        return B64.encode(Buffer.from(value as Uint8Array), B64U);
      }
      if (spec.domain === "confirmation") return decodeCnf(value as Map<number, unknown>);
      if (ACT_DOMAINS.has(spec.domain)) {
        // Compact act decodes from a Map; the interoperable form is an object.
        return value instanceof Map ? decodeActCompact(value) : value;
      }
      if (spec.domain === "subjectId") {
        return value instanceof Map ? decodeSubIdCompact(value) : value;
      }
      return value; // events / authorizationDetails (dynamic keys; string-keyed)
  }
};

/**
 * Encode the DOMAIN-keyed common claims into a CWT claims map (RFC 8392):
 * integer labels where the registry has one, the JOSE string name where it does
 * not, and custom passthrough claims under their literal key. Values are
 * transformed per the registry's value kind (timestamps -> int, cti/hashes ->
 * bstr, …). The returned `Map` is ready to hand to the CBOR encoder.
 */
export type EncodeCwtOptions = {
  /**
   * Use compact private-use integer COSE labels (default `true`): claims with a
   * private-use label (`< -65536`) are keyed by that integer on-platform, and
   * the structured `act`/`subjectId` use their compact integer-keyed form. Set
   * `false` for off-platform tokens — those claims are emitted under their JOSE
   * string key instead of the private-use integer label (never dropped), and
   * `act`/`subjectId` are emitted as interoperable string-keyed objects. The
   * flag only chooses digit-vs-string; no claim is ever omitted.
   */
  proprietary?: boolean;
};

export const encodeCwtClaims = (
  common: Dict,
  options: EncodeCwtOptions = {},
): Map<number | string, unknown> => {
  const proprietary = options.proprietary ?? true;
  const map = new Map<number | string, unknown>();

  for (const [domain, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = specByDomain(domain);
    if (!spec) {
      // Custom passthrough claim — keep its literal key.
      map.set(domain, value);
      continue;
    }

    // Private-use labels (no registered CWT label; chosen because the integer
    // is the smaller wire encoding) are keyed by that integer on-platform and
    // degrade to their JOSE string key off-platform (interoperable). Claims are
    // NEVER dropped.
    const isPrivate = typeof spec.cose === "number" && spec.cose < -65536;
    const key = isPrivate && !proprietary ? spec.jose : (spec.cose ?? spec.jose);
    map.set(key, encodeValue(spec, value, proprietary));
  }

  return map;
};

/**
 * Decode a CWT claims map back into the DOMAIN-keyed common shape (integer
 * label / jose string -> domain name; values reversed). Unknown keys are kept
 * verbatim. The result feeds the same verify floor as the JOSE parse.
 */
export const decodeCwtClaims = (map: Map<unknown, unknown>): Dict => {
  const common: Dict = {};

  for (const [key, value] of map) {
    const spec =
      typeof key === "number"
        ? specByCose(key)
        : typeof key === "string"
          ? specByJose(key)
          : undefined;

    if (!spec) {
      common[String(key)] = value;
      continue;
    }

    common[spec.domain] = decodeValue(spec, value);
  }

  return common;
};
