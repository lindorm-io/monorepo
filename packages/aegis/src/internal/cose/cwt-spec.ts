import type { CborField, CborValueKind } from "@lindorm/cbor";
import { CborKit } from "@lindorm/cbor";
import type { Dict } from "@lindorm/types";
import {
  CLAIMS_REGISTRY,
  type ClaimSpec,
  claimsWith,
} from "../claims/claims-registry.js";
import { decodeActCompact, encodeActCompact } from "./act-claim.js";
import { decodeCnf, encodeCnf } from "./cose-key.js";
import { decodeSubIdCompact, encodeSubIdCompact } from "./sub-id-claim.js";

// The CWT claims layer expressed as one declarative CBOR spec over the single
// claim registry, replacing the hand-rolled encode/decode engine while keeping the
// wire BYTE-IDENTICAL. Only the map-level mapping (label ↔ JOSE key, value kinds,
// the proprietary dual-key) lives here; the COSE byte layer (Tag / Buffer / CDE /
// preferMap) stays in cbor.ts, fed the map this kit produces.

// OIDC hash claims: b64url string <-> COSE byte string (cbor's native bstr kind;
// "b64u" is the same url-safe alphabet as the constant B64U). DERIVED from the
// registry `bespoke` sub-kinds — the single source of truth — never hardcoded:
// `"hash"` are the OIDC hashes (at_hash/c_hash/s_hash), `"act"` the RFC 8693
// delegation claims (act/may_act).
const HASH_DOMAINS = new Set(
  claimsWith("bespoke")
    .filter((spec) => spec.bespoke === "hash")
    .map((spec) => spec.domain),
);
const ACT_DOMAINS = new Set(
  claimsWith("bespoke")
    .filter((spec) => spec.bespoke === "act")
    .map((spec) => spec.domain),
);

// cti (RFC 8392 label 7): the token id string is carried as its raw UTF-8 bytes.
const encodeCti = (value: unknown): Buffer => Buffer.from(String(value), "utf8");
const decodeCti = (wire: unknown): string =>
  Buffer.from(wire as Uint8Array).toString("utf8");

// The value-shaping half of a claim whose registry kind is "bespoke", keyed by its
// domain name. Since Phase 5 the translator (`domainToCose`) delivers ALREADY-WIRE
// values, so these handlers do CBOR byte/structure concerns ONLY: hashes fold into
// cbor's bstr kind; `cnf` accepts the JOSE `cnf` (`jkt`/`jwk`/`kid`) the translator
// built and turns it into a COSE cnf map (encodeCnf); `act`/`mayAct` accept the
// wire act (`sub`/`iss`/`aud`/`client_id`) and switch compact-vs-interoperable on
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

// The codec KEYS by the COSE name (`spec.coseName ?? spec.jose`) — the vocabulary
// `domainToCose`/`coseToDomain` speak, so a name-diverging claim is looked up under
// its COSE name (`cti`, not `jti`); the on-wire label is unchanged (`cti` keeps
// integer label 7), so the bytes stay identical. The label is the registered /
// private-use integer where one exists, else the wire string (labels:"mixed"). A
// private-use label (< -65536) is proprietary: compact integer on-platform, string
// key off-platform.
const fieldForClaim = (spec: ClaimSpec): CborField => {
  const wireKey = spec.coseName ?? spec.jose;
  const base = {
    key: wireKey,
    label: spec.cose ?? wireKey,
    proprietary: typeof spec.cose === "number" && spec.cose < -65536,
  };

  switch (spec.value) {
    case "text":
    case "int":
    case "array":
    case "date":
    case "bool":
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
  fields: CLAIMS_REGISTRY.map(fieldForClaim),
});
