import { B64 } from "@lindorm/b64";
import { getUnixTime } from "@lindorm/date";
import { isDate, isFinite } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../constants/format.js";
import { AegisError } from "../../errors/index.js";
import {
  type ClaimSpec,
  specByCose,
  specByDomain,
  specByJose,
} from "../claims/registry.js";

// Structured claims whose COSE value representation is a later step:
//   - confirmation (cnf): needs the JWK -> COSE_Key conversion (P6),
//   - act / mayAct / subjectId / events / authorizationDetails: nested objects
//     that need a decided CBOR shape + Map<->object fidelity handling (P4).
// Their flat siblings (the OIDC hash claims) ARE handled, as bstr.
const HASH_DOMAINS = new Set(["accessTokenHash", "codeHash", "stateHash"]);

const deferred = (domain: string): never => {
  throw new AegisError(`COSE encoding of the "${domain}" claim is not yet supported`, {
    code: "cose_claim_not_supported",
    data: { claim: domain },
    title: "COSE Claim Not Supported",
    details:
      "This structured claim (cnf / act / mayAct / sub_id / events / authorization_details) needs its COSE value representation, which is a later step; flat claims are supported.",
  });
};

const encodeValue = (spec: ClaimSpec, value: unknown): unknown => {
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
      return deferred(spec.domain);
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
      return deferred(spec.domain);
  }
};

/**
 * Encode the DOMAIN-keyed common claims into a CWT claims map (RFC 8392):
 * integer labels where the registry has one, the JOSE string name where it does
 * not, and custom passthrough claims under their literal key. Values are
 * transformed per the registry's value kind (timestamps -> int, cti/hashes ->
 * bstr, …). The returned `Map` is ready to hand to the CBOR encoder.
 */
export const encodeCwtClaims = (common: Dict): Map<number | string, unknown> => {
  const map = new Map<number | string, unknown>();

  for (const [domain, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = specByDomain(domain);
    if (!spec) {
      // Custom passthrough claim — keep its literal key.
      map.set(domain, value);
      continue;
    }

    map.set(spec.cose ?? spec.jose, encodeValue(spec, value));
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
