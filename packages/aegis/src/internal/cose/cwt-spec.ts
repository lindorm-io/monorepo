import { CborKit } from "@lindorm/cbor";
import type { CborField, CborValueKind } from "@lindorm/cbor";
import type { Dict } from "@lindorm/types";
import { CLAIM_REGISTRY, type ClaimSpec } from "../claims/registry.js";
import { decodeActCompact, encodeActCompact } from "./act-claim.js";
import { decodeCnf, encodeCnf } from "./cose-key.js";
import { decodeSubIdCompact, encodeSubIdCompact } from "./sub-id-claim.js";

// The CWT claims layer expressed as one declarative CBOR spec over the single
// claim registry, replacing the hand-rolled encode/decode engine while keeping the
// wire BYTE-IDENTICAL. Only the map-level mapping (label ↔ JOSE key, value kinds,
// the proprietary dual-key) lives here; the COSE byte layer (Tag / Buffer / CDE /
// preferMap) stays in cbor.ts, fed the map this kit produces.

// OIDC hash claims: b64url string <-> COSE byte string (cbor's native bstr kind;
// "b64u" is the same url-safe alphabet as the constant B64U).
const HASH_DOMAINS = new Set(["accessTokenHash", "codeHash", "stateHash"]);
const ACT_DOMAINS = new Set(["act", "mayAct"]);

// cti (RFC 8392 label 7): the token id string is carried as its raw UTF-8 bytes.
const encodeCti = (value: unknown): Buffer => Buffer.from(String(value), "utf8");
const decodeCti = (wire: unknown): string =>
  Buffer.from(wire as Uint8Array).toString("utf8");

// The value-shaping half of a claim whose registry kind is "bespoke", keyed by its
// domain name: hashes fold into cbor's bstr kind; the structured claims delegate to
// their COSE helpers. `act`/`mayAct`/`subjectId` switch compact-vs-interoperable on
// the encode `proprietary` option; the rest are carried verbatim.
const shapeByDomain = (domain: string): Partial<CborField> => {
  if (HASH_DOMAINS.has(domain)) return { kind: "bstr", encoding: "b64u" };

  if (domain === "confirmation") {
    return {
      kind: "bespoke",
      encode: (value) => encodeCnf(value as Dict),
      decode: (value) => decodeCnf(value as Map<number, unknown>),
    };
  }

  if (ACT_DOMAINS.has(domain)) {
    return {
      kind: "bespoke",
      encode: (value, options) =>
        options.proprietary ? encodeActCompact(value as Dict) : value,
      decode: (value) => (value instanceof Map ? decodeActCompact(value) : value),
    };
  }

  if (domain === "subjectId") {
    return {
      kind: "bespoke",
      encode: (value, options) =>
        options.proprietary ? encodeSubIdCompact(value as Dict) : value,
      decode: (value) => (value instanceof Map ? decodeSubIdCompact(value) : value),
    };
  }

  // events / authorizationDetails: dynamic string-keyed shapes carried verbatim.
  return { kind: "bespoke", encode: (value) => value, decode: (value) => value };
};

// The wire key is the JOSE name; the label is the registered / private-use integer
// where one exists, else the JOSE string (labels:"mixed"). A private-use label
// (< -65536) is proprietary: compact integer on-platform, JOSE string off-platform.
const fieldForClaim = (spec: ClaimSpec): CborField => {
  const base = {
    key: spec.jose,
    label: spec.cose ?? spec.jose,
    proprietary: typeof spec.cose === "number" && spec.cose < -65536,
  };

  switch (spec.value) {
    case "text":
    case "int":
    case "array":
    case "date":
      return { ...base, kind: spec.value as CborValueKind };
    case "bstr":
      return { ...base, kind: "bespoke", encode: encodeCti, decode: decodeCti };
    case "bespoke":
      return { ...base, ...shapeByDomain(spec.domain) } as CborField;
  }
};

export const CWT_CLAIMS_KIT = new CborKit({
  labels: "mixed",
  mode: "lax",
  fields: CLAIM_REGISTRY.map(fieldForClaim),
});
